import { supabase } from "./supabase";
import { getPublicProfilesByIds } from './user-profiles'

export async function saveGlobalChatMessage(data) {
    const { error } = await supabase
        .from('global_chat_messages')
        .insert({
            sender_id: data.sender_id,
            email: data.email,
            content: data.content,
        });

    if (error) {
        console.error('[globa-chat.js saveGlobalChatMessage] Error:', error);
        throw new Error(error.message);
    }
    
    // Check chat master achievement
    try {
        const { checkChatMasterAchievement } = await import('./social-achievements')
        await checkChatMasterAchievement()
    } catch {}
}

export async function fetchLastGlobalChatMessages() {
    const { data, error } = await supabase
      .from('global_chat_messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
        console.error('[globa-chat.js fetchLastGlobalChatMessages] Error:', error);
        throw new Error(error.message);    
    }

    const rows = data || []
    // Enrich with display_name
    const ids = Array.from(new Set(rows.map(r => r.sender_id).filter(Boolean)))
    if (ids.length) {
        try {
            const { data: profs } = await getPublicProfilesByIds(ids)
            const map = {}
            for (const p of profs || []) map[p.id] = p
            for (const m of rows) {
                const p = map[m.sender_id]
                if (p) { m.display_name = p.display_name; m.avatar_url = p.avatar_url }
            }
        } catch {}
    }
    return rows;
}

export function suscribeToGlobalChatMessages(callback) {
    const chatChannel = supabase.channel('global_chat_messages');
      
    chatChannel.on(
        'postgres_changes',
        { 
            event: 'INSERT', 
            table: 'global_chat_messages',
            schema: 'public', 
        },
        async payload => {
            const msg = payload.new
            try {
                if (msg?.sender_id) {
                    const { data: profs } = await getPublicProfilesByIds([msg.sender_id])
                    const p = (profs || [])[0]
                    if (p) { msg.display_name = p.display_name; msg.avatar_url = p.avatar_url }
                }
            } catch {}
            callback(msg);
        }
    );
      
    chatChannel.subscribe();

    return () => {
        chatChannel.unsubscribe();
    };
}