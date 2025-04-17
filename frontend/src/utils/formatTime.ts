import { format } from 'date-fns';

/**
 * Formats a timestamp with robust validation
 * @param timestamp - Timestamp to format (can be number, string, Date or null/undefined)
 * @returns Formatted timestamp string or error message
 */
export const formatTime = (timestamp: number | string | Date | null | undefined) => {
  // Handle null/undefined/empty values
  if (timestamp === null || timestamp === undefined) {
    console.log('formatTime: Null or undefined timestamp');
    return 'Unknown time';
  }

  try {
    // Special handling for string timestamps that might not be numbers
    if (typeof timestamp === 'string' && isNaN(Number(timestamp))) {
      // Try parsing as a date string first
      const dateFromString = new Date(timestamp);
      if (!isNaN(dateFromString.getTime())) {
        timestamp = dateFromString.getTime();
      } else {
        console.error('formatTime: Cannot parse string timestamp:', timestamp);
        return 'Invalid date';
      }
    } else {
      // Convert to number if string
      const timestampNum = typeof timestamp === 'string' 
        ? Number(timestamp) 
        : timestamp instanceof Date 
          ? timestamp.getTime() 
          : timestamp;
      
      timestamp = timestampNum;
    }
    
    // Final validation of the number
    if (isNaN(timestamp as number)) {
      console.error('formatTime: Invalid timestamp (NaN) after conversion:', timestamp);
      return 'Invalid date';
    }
    
    // Additional validation to prevent React crashes
    if (typeof timestamp !== 'number') {
      console.error('formatTime: Timestamp is not a number after conversion:', timestamp, typeof timestamp);
      return 'Invalid date';
    }
    
    // Check for unreasonable timestamps (before 2020 or after 2030)
    if (timestamp < 1577836800000 || timestamp > 1893456000000) { // Jan 1 2020 to Jan 1 2030
      console.warn('formatTime: Timestamp outside reasonable range:', timestamp);
      
      // If it's a very small number, it might be in seconds instead of milliseconds
      if (timestamp < 1577836800) { // If before Jan 1, 2020 in seconds
        timestamp = timestamp * 1000;
        console.log('formatTime: Converting from seconds to milliseconds:', timestamp);
      } else {
        return 'Invalid date';
      }
    }
    
    // Create and validate date object
    const date = new Date(timestamp as number);
    if (isNaN(date.getTime())) {
      console.error('formatTime: Invalid date object created from timestamp:', timestamp);
      return 'Invalid date';
    }
    
    // Format based on relation to current time
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return `Today at ${format(date, "h:mm a")}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${format(date, "h:mm a")}`;
    } else {
      return format(date, "MMM d, yyyy 'at' h:mm a");
    }
  } catch (error) {
    console.error('formatTime: Error formatting timestamp:', error, 'Original timestamp:', timestamp);
    return 'Invalid time';
  }
};

/**
 * Formats a date for activity displays
 * @param dateTime - Date to format (accepts string or Date)
 * @returns Object with formatted date and time strings
 */
export const formatActivityDateTime = (dateTime: string | Date) => {
  try {
    // Handle empty or null values
    if (!dateTime) {
      console.warn('formatActivityDateTime: Empty or null dateTime');
      return { 
        date: 'Date unavailable', 
        time: 'Time unavailable',
        shortDate: 'Unavailable'
      };
    }
    
    // Try to convert to a proper date object
    let dateObj: Date;
    
    if (typeof dateTime === 'string') {
      // If it's a timestamp in milliseconds, convert directly
      if (!isNaN(Number(dateTime))) {
        dateObj = new Date(Number(dateTime));
      } else {
        // Otherwise parse as date string
        dateObj = new Date(dateTime);
      }
    } else {
      dateObj = dateTime;
    }
    
    // Validate the date
    if (isNaN(dateObj.getTime())) {
      console.error('formatActivityDateTime: Invalid date:', dateTime);
      return { 
        date: 'Invalid date', 
        time: 'Invalid time',
        shortDate: 'Invalid date'
      };
    }
    
    // Format the valid date
    return {
      date: format(dateObj, "EEEE, MMMM d, yyyy"),
      time: format(dateObj, "h:mm a"),
      shortDate: format(dateObj, "MMM d, yyyy")
    };
  } catch (error) {
    console.error('formatActivityDateTime: Error formatting date:', error, dateTime);
    return { 
      date: 'Error formatting date', 
      time: 'Error formatting time',
      shortDate: 'Error'
    };
  }
};
