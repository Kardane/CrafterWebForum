import BoardFeedPage from "@/components/posts/BoardFeedPage";

export const preferredRegion = "icn1";

interface DevelopePageProps {
	searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default function DevelopePage(props: DevelopePageProps) {
	return <BoardFeedPage board="develope" searchParams={props.searchParams} />;
}
