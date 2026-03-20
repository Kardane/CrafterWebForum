export const commentSectionStyles = `
	.comment-section {
		position: relative;
		display: flex;
		flex-direction: column;
	}

	.comment-section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 8px;
	}

	.pinned-list-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.comment-stream {
		/* 통합 스크롤 영역 */
	}

	.comment-list {
		padding: 0;
		overflow-anchor: none;
	}

	.older-loader {
		display: flex;
		justify-content: center;
		margin: 6px 0 14px;
	}

	.comment-row {
		display: block;
		width: 100%;
		content-visibility: auto;
		contain-intrinsic-size: 140px;
	}

	.comment-interactive-row {
		display: flex;
		align-items: stretch;
		width: 100%;
	}

	:global(.read-marker) {
		display: flex;
		align-items: center;
		width: 100%;
		gap: 10px;
		margin: 10px 0;
	}

	:global(.date-divider) {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		justify-content: center;
		align-self: stretch;
		width: 100%;
		gap: 8px;
		margin: 16px 0 12px;
	}

	:global(.date-divider .divider-label) {
		font-size: 8px;
		font-weight: 500;
		color: var(--text-muted);
		opacity: 0.5;
		line-height: 1;
		background: transparent;
		padding: 0 4px;
		white-space: nowrap;
		flex-shrink: 0;
		text-align: center;
	}

	:global(.read-marker .divider-label) {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--warning);
		background: color-mix(in srgb, var(--warning) 14%, transparent);
		padding: 2px 10px;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--warning) 42%, transparent);
	}

	:global(.date-divider .divider-line) {
		height: 1px;
		flex: 1;
		background: color-mix(in srgb, var(--border) 65%, transparent);
		opacity: 0.5;
	}

	:global(.read-marker .divider-line) {
		height: 1px;
		flex: 1;
		background: color-mix(in srgb, var(--warning) 45%, transparent);
	}

	.thread-toggle-row {
		padding-left: 48px;
		margin: 2px 0 8px;
	}

	.thread-toggle-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 1px solid var(--border);
		background: var(--bg-secondary);
		color: var(--text-secondary);
		padding: 4px 10px;
		border-radius: 999px;
		font-size: 0.78rem;
		transition: border-color 0.15s ease, color 0.15s ease;
	}

	.thread-toggle-btn:hover {
		color: var(--text-primary);
		border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
	}

	.thread-toggle-btn :global(svg) {
		transition: transform 0.15s ease;
	}

	.thread-toggle-btn :global(svg.expanded) {
		transform: rotate(180deg);
	}

	.pinned-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.pinned-item {
		width: 100%;
		padding: 10px 12px;
		text-align: left;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-secondary);
		transition: border-color 0.15s ease, background 0.15s ease;
	}

	.pinned-item:hover {
		border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
		background: var(--bg-tertiary);
	}

	.pinned-item-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 4px;
	}

	.pinned-item-author {
		font-size: 0.84rem;
		color: var(--text-primary);
		font-weight: 600;
	}

	.pinned-item-date {
		font-size: 0.74rem;
		color: var(--text-muted);
	}

	.pinned-item-preview {
		font-size: 0.86rem;
		color: var(--text-secondary);
		line-height: 1.45;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.composer-dock {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 56;
		display: flex;
		justify-content: center;
		padding: 0 16px 0 16px;
		pointer-events: none;
		overflow-anchor: none;
	}

	.composer-shell {
		width: 100%;
		max-width: none;
		pointer-events: auto;
		border-radius: 8px 8px 0 0;
		border: none;
		background: color-mix(in srgb, var(--color-bg-secondary) 95%, transparent);
		backdrop-filter: blur(4px);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
		padding: 4px;
	}

	@media (min-width: 769px) {
		.composer-dock {
			left: var(--spacing-sidebar);
			padding-left: 32px;
			padding-right: 32px;
		}
	}

	@media (max-width: 768px) {
		.comment-stream {
			max-height: min(52vh, 620px);
		}

		.thread-toggle-row {
			padding-left: 42px;
		}

		.composer-dock {
			padding: 0 12px calc(12px + 72px) 12px;
		}
	}
`;
