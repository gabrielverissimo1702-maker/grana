"use client";
import { supabaseBrowser } from "./client";

export function createDataBridge() {
  const supabase = supabaseBrowser();

  async function getUserId() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const userId = data.session?.user?.id;
    if (!userId) throw new Error("Usuario nao autenticado.");
    return userId;
  }

  return {
    async get(_key: string) {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("grana_data")
        .select("payload")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return { key: _key, value: JSON.stringify(data.payload), shared: false };
    },

    async set(_key: string, value: string) {
      const userId = await getUserId();
      const payload = JSON.parse(value);
      const { error } = await supabase
        .from("grana_data")
        .upsert({ user_id: userId, payload, updated_at: new Date().toISOString() });

      if (error) throw error;
      return { key: _key, value, shared: false };
    },
  };
}
