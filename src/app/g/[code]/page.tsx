// (2026-11-19, revamp step 2) The table screen: the night village. Other phases' screens arrive in step 3.
import { TableScreen } from "@/components/table/TableScreen";

export default async function GamePage(props: PageProps<"/g/[code]">) {
  const { code } = await props.params;
  return <TableScreen code={code} />;
}
