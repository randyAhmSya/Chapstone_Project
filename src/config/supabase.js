import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
	throw new Error(
		"SUPABASE_URL DAN SUPABASE_SERVICE_ROLE_KEY WAJIB DI ISI DI .ENV",
	);
}

const supabase = createClient(
	process.env.SUPABASE_URL,
	process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default supabase;
