/**
 * Utility functions for currency formatting
 */

/**
 * Format currency values to nearest thousand/lakh format
 * Examples: 1428470 → "₹14.28L", 50000 → "₹50K", 1500 → "₹1.5K"
 */
export function formatCurrencyCompact(value: string | number): string {
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/[,₹$\s]/g, '')) : value;
  
  if (isNaN(numValue) || numValue === 0) return '₹0';

  // For values >= 1 lakh (100,000), show in lakhs
  if (numValue >= 100000) {
    const lakhs = Math.round(numValue / 100000);
    return `₹${lakhs} L`;
  }
  
  // For values >= 1 thousand, show in thousands
  if (numValue >= 1000) {
    const thousands = Math.round(numValue / 1000);
    return `₹${thousands} K`;
  }
  
  // For smaller values, show normally
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(numValue);
}

/**
 * Parse localized number string for calculations
 */
export function parseLocalizedNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  // Remove commas, currency symbols, and other non-numeric characters except dots
  const cleanValue = value.toString().replace(/[,₹$\s]/g, '');
  const numValue = parseFloat(cleanValue);
  return isNaN(numValue) ? 0 : numValue;
}

/**
 * Format vendor name with category
 * Example: "Isosceles" + "Flooring" → "Isosceles - Flooring"
 */
export function formatVendorNameWithCategory(vendorName: string, categoryName?: string): string {
  if (!categoryName) return vendorName;
  return `${vendorName} - ${categoryName}`;
}

/**
 * Format vendor name with project and category for quotations
 * Example: "Isosceles" + "Maker Tower" + "Flooring" → "Isosceles / Maker Tower / Flooring"
 */
export function formatVendorNameWithProjectAndCategory(vendorName: string, projectName?: string, categoryName?: string): string {
  const parts = [vendorName];
  if (projectName) parts.push(projectName);
  if (categoryName) parts.push(categoryName);
  return parts.join(' / ');
}