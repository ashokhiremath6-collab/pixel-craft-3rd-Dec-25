import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";

export function getSession() {
  const sessionTtl = 30 * 24 * 60 * 60 * 1000; // 30 days
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl / 1000,
    tableName: "sessions",
    pruneSessionInterval: 60 * 15,
  });

  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: true, // Always secure — Replit always serves via HTTPS
      sameSite: "lax",
      maxAge: sessionTtl,
      path: "/",
    },
  });
}

async function assignDefaultRole(userId: string, email: string) {
  try {
    const existingRole = await storage.getUserRole(userId);
    if (existingRole) return;

    const managerProjects = await storage.getManagerProjectsByEmail(email);
    if (managerProjects.length > 0) {
      await storage.createUserRole({ userId, role: "project_manager", isActive: true, assignedBy: userId });
      for (const mp of managerProjects) {
        try {
          await storage.assignUserToProject({ userId, projectId: mp.projectId, assignedBy: userId });
        } catch {}
      }
    } else {
      const isDesigner = await storage.isDesignerEmail(email);
      await storage.createUserRole({
        userId,
        role: isDesigner ? "designer" : "client",
        isActive: true,
        assignedBy: userId,
      });
    }
  } catch (err) {
    console.error("[AUTH] Error assigning default role:", err);
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email.toLowerCase().trim());
          if (!user) {
            return done(null, false, { message: "No account found with that email." });
          }
          if (!user.passwordHash) {
            return done(null, false, {
              message:
                "This account has no password set. Use \"Forgot password?\" to set one.",
            });
          }
          const isValid = await bcrypt.compare(password, user.passwordHash);
          if (!isValid) {
            return done(null, false, { message: "Incorrect password." });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || false);
    } catch (err) {
      done(err);
    }
  });

  // POST /api/auth/login
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: info?.message || "Login failed" });
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        return res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        });
      });
    })(req, res, next);
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      res.json({ success: true });
    });
  });

  // Keep legacy GET /api/logout redirect for any bookmarked links
  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect("/");
    });
  });

  // POST /api/auth/register
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters." });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existing = await storage.getUserByEmail(normalizedEmail);
      if (existing) {
        if (existing.passwordHash) {
          return res.status(409).json({
            error: "An account already exists with this email. Please sign in.",
          });
        } else {
          // Existing account without password (former Replit user)
          return res.status(409).json({
            error:
              "This email is already registered. Please use \"Forgot password?\" to set your password.",
          });
        }
      }

      const hash = await bcrypt.hash(password, 12);
      const verificationToken = randomUUID();
      const userId = randomUUID();

      const user = await storage.upsertUser({
        id: userId,
        email: normalizedEmail,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        passwordHash: hash,
        emailVerificationToken: verificationToken,
      });

      await assignDefaultRole(user.id, normalizedEmail);

      // Send verification email (non-fatal if SMTP not configured)
      try {
        const baseUrl =
          process.env.APP_URL ||
          (process.env.REPLIT_DOMAINS
            ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
            : `${req.protocol}://${req.hostname}`);
        await sendVerificationEmail(normalizedEmail, verificationToken, baseUrl);
      } catch (emailErr) {
        console.error("[AUTH] Failed to send verification email:", emailErr);
      }

      return res.status(201).json({
        success: true,
        message: "Account created! Please check your email to verify your address.",
      });
    } catch (err) {
      console.error("[AUTH] Register error:", err);
      return res.status(500).json({ error: "Registration failed. Please try again." });
    }
  });

  // POST /api/auth/forgot-password
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required." });
      }

      const normalizedEmail = email.toLowerCase().trim();
      // Always respond success to prevent email enumeration
      const user = await storage.getUserByEmail(normalizedEmail);
      if (!user) {
        return res.json({
          success: true,
          message: "If that email is registered, a reset link has been sent.",
        });
      }

      const token = randomUUID();
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await storage.setPasswordResetToken(user.id, token, expiry);

      const baseUrl =
        process.env.APP_URL ||
        (process.env.REPLIT_DOMAINS
          ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
          : `${req.protocol}://${req.hostname}`);

      try {
        await sendPasswordResetEmail(normalizedEmail, token, baseUrl);
      } catch (emailErr) {
        console.error("[AUTH] Failed to send reset email:", emailErr);
      }

      return res.json({
        success: true,
        message: "If that email is registered, a reset link has been sent.",
      });
    } catch (err) {
      console.error("[AUTH] Forgot password error:", err);
      return res.status(500).json({ error: "Failed to process request. Please try again." });
    }
  });

  // POST /api/auth/reset-password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ error: "Token and password are required." });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters." });
      }

      const user = await storage.getUserByResetToken(token);
      if (
        !user ||
        !user.passwordResetTokenExpiry ||
        user.passwordResetTokenExpiry < new Date()
      ) {
        return res.status(400).json({
          error: "This reset link is invalid or has expired. Please request a new one.",
        });
      }

      const hash = await bcrypt.hash(password, 12);
      await storage.resetPassword(user.id, hash);

      return res.json({ success: true, message: "Password reset successfully. You can now sign in." });
    } catch (err) {
      console.error("[AUTH] Reset password error:", err);
      return res.status(500).json({ error: "Failed to reset password. Please try again." });
    }
  });

  // GET /api/auth/verify-email/:token
  app.get("/api/auth/verify-email/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const user = await storage.verifyEmail(token);
      if (!user) {
        return res.redirect("/?error=invalid-verification-token");
      }
      return res.redirect("/?verified=true");
    } catch (err) {
      console.error("[AUTH] Email verification error:", err);
      return res.redirect("/?error=verification-failed");
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};
