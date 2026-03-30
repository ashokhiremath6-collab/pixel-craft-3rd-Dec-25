import { File } from "@google-cloud/storage";

const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";

export enum ObjectAccessGroupType {}

export interface ObjectAccessGroup {
  type: ObjectAccessGroupType;
  id: string;
}

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclRule {
  group: ObjectAccessGroup;
  permission: ObjectPermission;
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
  aclRules?: Array<ObjectAclRule>;
}

function isPermissionAllowed(
  requested: ObjectPermission,
  granted: ObjectPermission,
): boolean {
  if (requested === ObjectPermission.READ) {
    return [ObjectPermission.READ, ObjectPermission.WRITE].includes(granted);
  }

  return granted === ObjectPermission.WRITE;
}

abstract class BaseObjectAccessGroup implements ObjectAccessGroup {
  constructor(
    public readonly type: ObjectAccessGroupType,
    public readonly id: string,
  ) {}

  public abstract hasMember(userId: string): Promise<boolean>;
}

function createObjectAccessGroup(
  group: ObjectAccessGroup,
): BaseObjectAccessGroup {
  switch (group.type) {
    default:
      throw new Error(`Unknown access group type: ${group.type}`);
  }
}

export async function setObjectAclPolicy(
  objectFile: File,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  const [exists] = await objectFile.exists();
  if (!exists) {
    throw new Error(`Object not found: ${objectFile.name}`);
  }

  await objectFile.setMetadata({
    metadata: {
      [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy),
    },
  });
}

export async function getObjectAclPolicy(
  objectFile: File,
): Promise<ObjectAclPolicy | null> {
  const [metadata] = await objectFile.getMetadata();
  const aclPolicy = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
  if (!aclPolicy) {
    return null;
  }
  return JSON.parse(aclPolicy as string);
}

export async function canAccessObject({
  userId,
  objectFile,
  requestedPermission,
}: {
  userId?: string;
  objectFile: File;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  console.log("🔐 canAccessObject called");
  console.log("   userId:", userId);
  console.log("   requestedPermission:", requestedPermission);
  console.log("   objectFile.name:", objectFile.name);
  
  try {
    console.log("📋 Getting ACL policy...");
    const aclPolicy = await getObjectAclPolicy(objectFile);
    console.log("✅ ACL policy retrieved:", aclPolicy);
    
    if (!aclPolicy) {
      // No ACL policy set — allow authenticated users to read, deny unauthenticated
      if (requestedPermission === ObjectPermission.READ && userId) {
        console.log("✅ No ACL policy — authenticated user READ allowed");
        return true;
      }
      console.log("❌ No ACL policy and no userId — denying access");
      return false;
    }

    if (
      aclPolicy.visibility === "public" &&
      requestedPermission === ObjectPermission.READ
    ) {
      console.log("✅ Public file - allowing READ access");
      return true;
    }

    if (!userId) {
      console.log("❌ No userId and not public - denying access");
      return false;
    }

    // Allow ALL authenticated users to READ any object
    if (requestedPermission === ObjectPermission.READ) {
      console.log("✅ Authenticated user requesting READ - allowing access");
      return true;
    }

    // For WRITE permission, check ownership and ACL rules
    if (aclPolicy.owner === userId) {
      console.log("✅ User is owner - allowing access");
      return true;
    }

    for (const rule of aclPolicy.aclRules || []) {
      const accessGroup = createObjectAccessGroup(rule.group);
      if (
        (await accessGroup.hasMember(userId)) &&
        isPermissionAllowed(requestedPermission, rule.permission)
      ) {
        console.log("✅ User in ACL group - allowing access");
        return true;
      }
    }

    console.log("❌ No matching ACL rules - denying access");
    return false;
  } catch (error) {
    console.error("❌ ERROR in canAccessObject:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    // In case of error, deny access for safety
    return false;
  }
}
