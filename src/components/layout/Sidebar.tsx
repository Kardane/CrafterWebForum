"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import classNames from "classnames";
import { Shield, Bell } from "lucide-react";
import UserAvatar from "@/components/ui/UserAvatar";
import SidebarTrackedPosts from "@/components/layout/SidebarTrackedPosts";
import { useNotifications } from "@/components/notifications/useNotifications";

interface SidebarProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
	const router = useRouter();
	const { data: session } = useSession();

	const user = session?.user;
	const canAccessAdmin = user ? user.role === "admin" : false;
	const { unreadCount } = useNotifications();

	return (
		<>
			<div
				className={classNames(
					"fixed inset-0 z-[99] bg-black/70 backdrop-blur-sm md:hidden",
					isOpen ? "block" : "hidden"
				)}
				onClick={onClose}
			/>

			<aside
				className={classNames(
					"fixed inset-y-0 left-0 z-sidebar flex w-sidebar flex-col border-r border-bg-tertiary bg-bg-secondary transition-transform duration-300 md:translate-x-0",
					isOpen ? "translate-x-0" : "-translate-x-full"
				)}
			>
				<nav className="flex-1 overflow-y-auto p-2">
					{user ? (
						<SidebarTrackedPosts onNavigate={onClose} />
					) : (
						<div className="px-2 py-4 text-xs text-text-muted">로그인하면 내 포스트 활동 목록 표시됨</div>
					)}
				</nav>

				{user ? (
					<div className="border-t border-bg-tertiary bg-bg-tertiary p-3">
						<div className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-bg-secondary">
							<Link href="/profile" className="flex min-w-0 flex-1 items-center gap-2" onClick={onClose}>
								<UserAvatar
									nickname={user.nickname}
									uuid={user.minecraftUuid}
									size={32}
									className="h-8 w-8"
								/>
								<div className="min-w-0">
									<div className="truncate text-sm font-medium text-text-primary">{user.nickname}</div>
									<div className="text-[11px] text-text-muted">{canAccessAdmin ? "관리자" : "사용자"}</div>
								</div>
							</Link>

							<button
								className="rounded px-2 py-1 text-xs text-text-muted transition-colors hover:bg-error hover:text-white"
								onClick={() => signOut({ callbackUrl: "/login" })}
								title="로그아웃"
							>
								로그아웃
							</button>
						</div>

						<div className="mt-2 flex gap-2">
							<Link
								href="/notifications"
								onClick={onClose}
								className="relative flex h-9 w-9 items-center justify-center rounded text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary"
								title="알림"
							>
								<Bell size={16} />
								{unreadCount > 0 && (
									<span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
										{unreadCount > 99 ? "99+" : unreadCount}
									</span>
								)}
							</Link>

							{canAccessAdmin ? (
								<Link
									href="/admin"
									onClick={onClose}
									className="flex h-9 w-9 items-center justify-center rounded text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary"
									title="관리자"
								>
									<Shield size={16} />
								</Link>
							) : (
								<div className="flex h-9 w-9 items-center justify-center rounded text-text-muted/60" title="관리자">
									<Shield size={16} />
								</div>
							)}
						</div>
					</div>
				) : (
					<div className="border-t border-bg-tertiary bg-bg-tertiary p-3">
						<button onClick={() => router.push("/login")} className="btn btn-primary w-full">
							로그인
						</button>
					</div>
				)}
			</aside>

		</>
	);
}
