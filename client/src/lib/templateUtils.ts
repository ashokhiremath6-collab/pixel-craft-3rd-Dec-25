/**
 * Utility functions for template naming and management
 */

/**
 * Generate a standardized template name based on category
 * Pattern: [Category Name] + " quote template"
 */
export function generateTemplateName(categoryName: string): string {
  return `${categoryName} quote template`;
}

/**
 * Check if a template name follows the standard naming convention
 */
export function isStandardTemplateName(templateName: string, categoryName: string): boolean {
  const expectedName = generateTemplateName(categoryName);
  return templateName.toLowerCase() === expectedName.toLowerCase();
}

/**
 * Get display name for template - uses standard naming if template doesn't follow convention
 */
export function getTemplateDisplayName(templateName: string, categoryName: string): string {
  if (!categoryName) return templateName;
  
  // Always use the standard naming convention for display
  return generateTemplateName(categoryName);
}