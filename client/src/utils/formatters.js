/**
 * Format a date into relative time string
 * "just now", "2 minutes ago", "2 hours ago", "Yesterday", "3 days ago", then full date
 */
export function formatDate(date) {
  if (!date) return '';
  const now = new Date();
  const d = new Date(date);
  const diffMs = now - d;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return formatFullDate(date);
}

/**
 * Format date as "Nov 4, 2024"
 */
export function formatFullDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Format seconds into mm:ss
 */
export function formatTime(seconds) {
  if (seconds == null || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format points with comma separator: 1250 → "1,250"
 */
export function formatPoints(points) {
  if (points == null) return '0';
  return Number(points).toLocaleString('en-US');
}

/**
 * Truncate text to maxLen characters with "..."
 */
export function truncateText(text, maxLen = 100) {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '...';
}

/**
 * Get initials from a name (first letters of first two words, uppercase)
 */
export function getInitials(name) {
  if (!name) return '??';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

/**
 * Get status color classes for pending/approved/rejected/suspended/active
 * Returns { bg, text, border } Tailwind-style color strings
 */
export function getStatusColor(status) {
  const statusMap = {
    pending: {
      bg: 'bg-comic-yellow',
      text: 'text-ink',
      border: 'border-comic-yellow',
      cssClass: 'status-pending',
    },
    approved: {
      bg: 'bg-victory-green',
      text: 'text-white',
      border: 'border-victory-green',
      cssClass: 'status-approved',
    },
    active: {
      bg: 'bg-victory-green',
      text: 'text-white',
      border: 'border-victory-green',
      cssClass: 'status-active',
    },
    rejected: {
      bg: 'bg-punch-red',
      text: 'text-white',
      border: 'border-punch-red',
      cssClass: 'status-rejected',
    },
    suspended: {
      bg: 'bg-secondary-grey',
      text: 'text-ink',
      border: 'border-secondary-grey',
      cssClass: 'status-suspended',
    },
  };

  return (
    statusMap[status?.toLowerCase()] || {
      bg: 'bg-secondary-grey',
      text: 'text-ink',
      border: 'border-secondary-grey',
      cssClass: 'status-pending',
    }
  );
}
