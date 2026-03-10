import BoardFeedPage from "@/components/posts/BoardFeedPage";

export const preferredRegion = "icn1";

interface SinmungoPageProps {
	searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default function SinmungoPage(props: SinmungoPageProps) {
	return <BoardFeedPage board="sinmungo" searchParams={props.searchParams} />;
}
