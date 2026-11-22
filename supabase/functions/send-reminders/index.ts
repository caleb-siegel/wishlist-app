// Supabase Edge Function: Scheduled Occasion Push Reminder Dispatcher
// Runs daily (e.g. via pg_cron or GitHub Action / external scheduler)
// Dispatches 1-month-prior push notifications to connected partners via Expo Push Service.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

interface PushMessage {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data: Record<string, any>;
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase service environment variables' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optional test payload for development testing: { test_occasion_id: string, test_viewer_id: string }
    let testOccasionId: string | null = null;
    let testViewerId: string | null = null;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        testOccasionId = body.test_occasion_id || null;
        testViewerId = body.test_viewer_id || null;
      } catch {
        // No body provided, run regular daily scan
      }
    }

    const now = new Date();
    const currentYear = now.getFullYear();

    // Query active occasions with enabled reminders
    let query = supabase
      .from('occasions')
      .select(`
        id,
        name,
        date,
        recurs_annually,
        timezone,
        owner_user_id,
        profiles:owner_user_id ( display_name ),
        occasion_reminders!inner (
          id,
          viewer_user_id,
          lead_time,
          enabled
        )
      `)
      .eq('enabled', true)
      .eq('occasion_reminders.enabled', true);

    if (testOccasionId) {
      query = query.eq('id', testOccasionId);
    }

    const { data: occasions, error: occError } = await query;

    if (occError) {
      return new Response(JSON.stringify({ error: occError.message }), { status: 500 });
    }

    const sentDeliveries: any[] = [];
    const messagesToSend: PushMessage[] = [];

    for (const occ of occasions || []) {
      const ownerName = (occ.profiles as any)?.display_name || 'Your partner';
      const parts = occ.date.split('-').map(Number);
      const origMonth = parts[1] - 1;
      const origDay = parts[2];

      // Compute occurrence year
      let occurrenceYear = occ.recurs_annually ? currentYear : parts[0];
      let occasionDate = new Date(occurrenceYear, origMonth, origDay);
      if (occ.recurs_annually && occasionDate < now && !testOccasionId) {
        occurrenceYear += 1;
        occasionDate = new Date(occurrenceYear, origMonth, origDay);
      }

      // Calculate 1 month prior
      let targetMonth = origMonth - 1;
      let targetYear = occurrenceYear;
      if (targetMonth < 0) {
        targetMonth = 11;
        targetYear -= 1;
      }
      const maxDaysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      const clampedDay = Math.min(origDay, maxDaysInTargetMonth);
      const reminderDueDate = new Date(targetYear, targetMonth, clampedDay);

      // Check if today matches the reminder date (or in test mode)
      const isDueToday =
        testOccasionId ||
        (now.getFullYear() === reminderDueDate.getFullYear() &&
          now.getMonth() === reminderDueDate.getMonth() &&
          now.getDate() === reminderDueDate.getDate());

      if (!isDueToday) {
        continue;
      }

      for (const reminder of (occ as any).occasion_reminders || []) {
        const viewerId = reminder.viewer_user_id;
        if (testViewerId && viewerId !== testViewerId) continue;

        // Check if already delivered for this occurrence year
        const { data: existingDelivery } = await supabase
          .from('notification_deliveries')
          .select('id')
          .eq('occasion_id', occ.id)
          .eq('viewer_user_id', viewerId)
          .eq('occurrence_year', occurrenceYear)
          .eq('lead_time', 'one_month')
          .maybeSingle();

        if (existingDelivery && !testOccasionId) {
          // Already sent! Skip duplicate
          continue;
        }

        // Get viewer's registered push tokens
        const { data: devices } = await supabase
          .from('push_devices')
          .select('expo_push_token')
          .eq('user_id', viewerId)
          .is('disabled_at', null);

        if (!devices || devices.length === 0) {
          continue;
        }

        const notificationTitle = `${ownerName}'s ${occ.name}`;
        const notificationBody = `${ownerName} has an occasion in a month. Take a look at their gift wishlist!`;

        for (const device of devices) {
          messagesToSend.push({
            to: device.expo_push_token,
            sound: 'default',
            title: notificationTitle,
            body: notificationBody,
            data: {
              type: 'occasion_reminder',
              occasion_id: occ.id,
              owner_user_id: occ.owner_user_id,
            },
          });
        }

        // Record in notification_deliveries for deduplication
        const { data: delivery } = await supabase
          .from('notification_deliveries')
          .upsert(
            {
              occasion_id: occ.id,
              viewer_user_id: viewerId,
              occurrence_year: occurrenceYear,
              lead_time: 'one_month',
              scheduled_for: reminderDueDate.toISOString(),
              sent_at: new Date().toISOString(),
              status: 'sent',
            },
            { onConflict: 'occasion_id,viewer_user_id,occurrence_year,lead_time' }
          )
          .select()
          .single();

        sentDeliveries.push(delivery);
      }
    }

    // Send push batches via Expo Push Service
    if (messagesToSend.length > 0) {
      const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(messagesToSend),
      });

      const pushResult = await pushResponse.json();
      return new Response(
        JSON.stringify({
          success: true,
          dispatchedCount: messagesToSend.length,
          deliveries: sentDeliveries,
          expoResponse: pushResult,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'No reminders due today',
        dispatchedCount: 0,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
