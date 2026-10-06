import Game from "@/components/Game";

export default async function GamePage(props: PageProps<"/g/[code]">) {
  const { code } = await props.params;
  return <Game code={code.toUpperCase()} />;
}
