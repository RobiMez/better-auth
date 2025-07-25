export const ENV = {
	NEXT_PUBLIC_WEBSITE_URL:
		process.env.NEXT_PUBLIC_WEBSITE_URL || "http://localhost:3000",
	NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "",
	NODE_ENV: process.env.NODE_ENV || "development",
	NEXT_PUBLIC_AI_CHAT_API_TOKEN:
		process.env.NEXT_PUBLIC_AI_CHAT_API_TOKEN || "",
};
