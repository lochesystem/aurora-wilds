import type { Metadata } from "next";
import GameShell from "./game/GameShell";

export const metadata: Metadata = {
  title: "Aurora Wilds — Sobrevivência procedural 3D",
  description: "Explore um mundo procedural sem bordas e sobreviva coletando recursos.",
};

export default function Home() {
  return <GameShell />;
}
