import type { Destination } from '../data/destinations';

export type Enquiry = {
  name: string;
  month: string;
  travelers: string;
  style: string;
};

export function formatMonth(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return 'Dates flexible';
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthNumber - 1, 1));
}

export function buildEnquiryMessage(destination: Destination, enquiry: Enquiry): string {
  return [
    'Hello AERIVA Journeys,',
    '',
    `I would like to plan a trip to ${destination.name}.`,
    `Departure city: Hyderabad`,
    `Travel period: ${formatMonth(enquiry.month)}`,
    `Travelers: ${enquiry.travelers}`,
    `Experience: ${enquiry.style}`,
    `Name: ${enquiry.name.trim() || 'Not provided'}`,
    '',
    'Please share a personalized itinerary and quotation.',
  ].join('\n');
}

export function whatsAppLink(number: string | undefined, message: string): string | null {
  const digits = (number || '').replace(/[\s()+\-]/g, '');
  if (!/^\d{10,15}$/.test(digits)) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
