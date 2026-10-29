import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { Screen } from "../../components/ui";
import { getPuzzleLevel } from "../../lib/puzzles";

/** Legacy `/puzzles/:id` → timer play for that level's difficulty. */
export default function LegacyPuzzleRedirect() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const level = getPuzzleLevel(Number(rawId));

  useEffect(() => {
    if (!level) {
      router.replace("/puzzles" as Href);
      return;
    }
    router.replace(
      `/puzzles/timer/${level.difficulty.toLowerCase()}/${level.id}` as Href
    );
  }, [level, router]);

  return <Screen>{null}</Screen>;
}
