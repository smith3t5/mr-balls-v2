// Cloudflare Pages Functions middleware for cron triggers
// This handles scheduled cron jobs

export const onRequest: PagesFunction<Env> = async (context) => {
  // Pass through to Next.js for regular requests
  return context.next();
};

// Handle scheduled cron triggers
export const onScheduled: PagesFunction<Env> = async (context) => {
  const { env } = context;

  try {
    console.log('Cron trigger fired: Generating Sharp Play of the Day');

    // Call the sharp play generation endpoint
    const response = await fetch(`${context.request.url.origin}/api/sharp-play/daily`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CRON_SECRET || 'dev-secret'}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (response.ok) {
      console.log('Sharp play generated successfully:', result);
    } else {
      console.error('Failed to generate sharp play:', result);
    }
  } catch (error) {
    console.error('Cron job error:', error);
  }
};
