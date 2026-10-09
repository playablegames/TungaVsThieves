import Game from "@/components/Game";

export default async function GamePage(props: PageProps<"/g/[code]">) {
  const { code } = await props.params;
  // keyed by the code: PLAY AGAIN moves to a new table, and every hook starts fresh there
  return <Game key={code.toUpperCase()} code={code.toUpperCase()} />;
}
