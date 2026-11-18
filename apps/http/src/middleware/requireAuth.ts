import { auth } from "@v7/auth";
import { fromNodeHeaders } from "better-auth/node";
import type { RequestHandler } from "express";

declare global {
	namespace Express {
		interface Request {
			userId?: string;
		}
	}
}

export const requireAuth: RequestHandler = async (req, res, next) => {
	const session = await auth.api.getSession({
		headers: fromNodeHeaders(req.headers),
	});

	if (!session) {
		res.status(401).json({ error: "Unauthorized" });
		return;
	}

	req.userId = session.user.id;
	next();
};
