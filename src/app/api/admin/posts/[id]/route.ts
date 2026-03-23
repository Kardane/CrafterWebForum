import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { getPostMutationTags, parsePostTags, safeRevalidateTags } from "@/lib/cache-tags";
import { JsonBodyError, readJsonBody } from "@/lib/http-body";
import { z } from "zod";


function parsePostId(value: string) {
	const postId = parseInt(value, 10);
	if (Number.isNaN(postId)) {
		return null;
	}
	return postId;
}

function parsePermanentFlag(value: string | null) {
	return value === "true";
}

const restorePostBodySchema = z.object({
	action: z.literal("restore"),
});

function selectArchiveTarget(postId: number) {
	return prisma.post.findFirst({
		where: { id: postId },
		select: {
			id: true,
			tags: true,
			deletedAt: true,
		},
	});
}

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) return admin.response;

		const { id } = await params;
		const postId = parsePostId(id);
		if (!postId) {
			return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
		}

		const parsedBody = restorePostBodySchema.safeParse(
			await readJsonBody(request, { maxBytes: 32 * 1024 })
		);
		if (!parsedBody.success) {
			return NextResponse.json({ error: "Invalid action" }, { status: 400 });
		}

		const post = await selectArchiveTarget(postId);
		if (!post) {
			return NextResponse.json({ error: "Post not found" }, { status: 404 });
		}
		if (!post.deletedAt) {
			return NextResponse.json({ error: "Post is not archived" }, { status: 409 });
		}

		await prisma.post.update({
			where: { id: postId },
			data: { deletedAt: null },
		});
		safeRevalidateTags(
			getPostMutationTags({
				postId,
				tags: parsePostTags(post.tags),
			})
		);
		console.info(
			`[Admin] Post restored by ${admin.session.user.id}: target=${postId}`
		);

		return NextResponse.json({ success: true, mode: "restored" });
	} catch (error) {
		if (error instanceof JsonBodyError) {
			return NextResponse.json({ error: error.code }, { status: error.status });
		}
		console.error("[API] PATCH /api/admin/posts/[id] error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) return admin.response;

		const { id } = await params;
		const postId = parsePostId(id);
		if (!postId) {
			return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
		}
		const isPermanent = parsePermanentFlag(
			new URL(request.url).searchParams.get("permanent")
		);

		const post = await selectArchiveTarget(postId);
		if (!post) {
			return NextResponse.json({ error: "Post not found" }, { status: 404 });
		}

		if (!post.deletedAt) {
			await prisma.post.update({
				where: { id: postId },
				data: { deletedAt: new Date() },
			});
			safeRevalidateTags(
				getPostMutationTags({
					postId,
					tags: parsePostTags(post.tags),
				})
			);
			console.warn(
				`[Admin] Post archived by ${admin.session.user.id}: target=${postId}`
			);
			return NextResponse.json({ success: true, mode: "archived" });
		}

		if (!isPermanent) {
			return NextResponse.json(
				{ error: "Post is archived. Use permanent delete option" },
				{ status: 409 }
			);
		}

		await prisma.post.delete({ where: { id: postId } });
		safeRevalidateTags(
			getPostMutationTags({
				postId,
				tags: parsePostTags(post.tags),
			})
		);
		console.warn(
			`[Admin] Post permanently deleted by ${admin.session.user.id}: target=${postId}`
		);
		return NextResponse.json({ success: true, mode: "permanently_deleted" });
	} catch (error) {
		console.error("[API] DELETE /api/admin/posts/[id] error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
