export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      sendEvent('connected', { status: 'connected' });

      let progress = 0;

      const interval = setInterval(() => {
        progress += 20;
        if (progress < 100) {
          sendEvent('progress', { progress });
        }
      }, 1000);

      setTimeout(() => {
        clearInterval(interval);
        sendEvent('done', { status: 'done' });
        controller.close();
      }, 5000);
    },
    cancel() {
      // No-op for this mock stream.
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
