import { serve } from 'https://deno.fresh.dev/std@v9.6.1/http/server.ts';

serve(async (req) => {
  const token = Deno.env.get('MAPBOX_TOKEN');
  
  return new Response(
    JSON.stringify({ token }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );
});