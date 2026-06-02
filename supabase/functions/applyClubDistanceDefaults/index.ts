import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceClient, getUser } from '../_shared/supabase.ts';

function getDefaults(hcp: number) {
  if (hcp <= 5) return { driver_distance: 270, three_wood_distance: 245, five_wood_distance: 225, four_iron_distance: 205, five_iron_distance: 195, six_iron_distance: 183, seven_iron_distance: 170, eight_iron_distance: 158, nine_iron_distance: 145, pitching_wedge_distance: 132, gap_wedge_distance: 118, sand_wedge_distance: 100, lob_wedge_distance: 80 };
  if (hcp <= 12) return { driver_distance: 240, three_wood_distance: 220, five_wood_distance: 200, four_iron_distance: 185, five_iron_distance: 175, six_iron_distance: 163, seven_iron_distance: 150, eight_iron_distance: 138, nine_iron_distance: 125, pitching_wedge_distance: 112, gap_wedge_distance: 98, sand_wedge_distance: 82, lob_wedge_distance: 65 };
  if (hcp <= 20) return { driver_distance: 215, three_wood_distance: 195, five_wood_distance: 178, four_iron_distance: 165, five_iron_distance: 155, six_iron_distance: 143, seven_iron_distance: 130, eight_iron_distance: 118, nine_iron_distance: 107, pitching_wedge_distance: 95, gap_wedge_distance: 82, sand_wedge_distance: 68, lob_wedge_distance: 54 };
  return { driver_distance: 185, three_wood_distance: 168, five_wood_distance: 153, four_iron_distance: 142, five_iron_distance: 133, six_iron_distance: 122, seven_iron_distance: 110, eight_iron_distance: 100, nine_iron_distance: 90, pitching_wedge_distance: 80, gap_wedge_distance: 68, sand_wedge_distance: 56, lob_wedge_distance: 44 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const db = serviceClient();

    const { data: profiles } = await db.from('user_profile').select('*').eq('user_email', user.email).limit(1);
    const profile = profiles?.[0];
    if (!profile) return json({ skipped: true });

    const distanceKeys = ['driver_distance', 'three_wood_distance', 'five_wood_distance', 'four_iron_distance', 'five_iron_distance', 'six_iron_distance', 'seven_iron_distance', 'eight_iron_distance', 'nine_iron_distance', 'pitching_wedge_distance', 'gap_wedge_distance', 'sand_wedge_distance', 'lob_wedge_distance'];
    const hasAny = distanceKeys.some((k) => profile[k] != null && profile[k] > 0);
    if (hasAny) return json({ skipped: true, reason: 'already has distances' });

    const defaults = getDefaults(profile.current_handicap ?? 18);
    const { error } = await db.from('user_profile').update(defaults).eq('id', profile.id);
    if (error) throw error;

    return json({ success: true });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
