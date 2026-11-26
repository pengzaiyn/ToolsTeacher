// Vercel Cron Job: Tự động chạy lúc 02:00 sáng giờ Việt Nam (19:00 UTC hôm trước)
// Gọi sang Supabase Edge Function `sync-cis-students` (action: 'cron_sync')
// để đồng bộ sinh viên mới nhập học, cập nhật hồ sơ từ CIS và tự động xếp lớp.

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronSecret = (process.env.CRON_SECRET || '').trim();
  const authHeader = req.headers.authorization || '';
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized cron trigger' });
  }

  const supabaseUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://gyzgvnseizvkonustvyh.supabase.co'
  ).replace(/\/+$/, '');

  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  const edgeCronKey = (process.env.CRON_SECRET || process.env.CIS_API_TOKEN || '').trim();

  if (!edgeCronKey) {
    return res.status(503).json({
      error: 'Missing CRON_SECRET or CIS_API_TOKEN in Vercel environment variables',
    });
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/sync-cis-students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(supabaseAnonKey
          ? {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
            }
          : {}),
        'x-cron-secret': edgeCronKey,
      },
      body: JSON.stringify({
        action: 'cron_sync',
        mode: 'incremental',
      }),
    });

    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json({
      ok: response.ok,
      triggeredAt: new Date().toISOString(),
      result: data,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Cron sync failed',
    });
  }
}

