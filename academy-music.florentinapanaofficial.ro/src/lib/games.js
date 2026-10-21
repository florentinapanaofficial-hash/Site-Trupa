import { supabase } from './supabase';

export async function gameRpc(name, args = {}) {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw error;
    return data;
}
