/**
 * Format a date string or timestamp to a human-readable format
 */
export const formatDate = (date: string | number | Date | undefined | null): string => {
  if (!date) return "No date";
  
  try {
    // Convert to Date object if it's not already
    const dateObj = typeof date === 'object' ? date : new Date(date);
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return "Invalid date";
    }
    
    // Format: Apr 15, 2025
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid date";
  }
};
