"use client";

import { Image as ImageIcon } from "lucide-react";
import type { MatchRow } from "@/lib/tournament-types";

export interface TreeRound {
  round: number;
  items: MatchRow[];
}

const CARD_W = 184;
const CARD_H = 66;
const GAP = 64;
const TOP = 42;
const PITCH = 92;
const PAD = 24;

function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  const text = parts.length > 1 ? parts.map((p) => p[0]).join("") : label.trim();
  return text.slice(0, 2).toUpperCase() || "?";
}

function tagColor(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 46%)`;
}

function roundTitle(index: number, total: number): string {
  const fromEnd = total - 1 - index;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  return `Round ${index + 1}`;
}

function winnerOf(m: MatchRow): "A" | "B" | null {
  if (!["approved", "forfeited"].includes(m.status)) return null;
  return m.reportedWinnerSide === "A" || m.reportedWinnerSide === "B"
    ? m.reportedWinnerSide
    : null;
}

/**
 * Connected single-elimination tree.
 * Connectors pair matches in order (match 1+2 feed the next round's match 1);
 * the team names on each card always come straight from the match data.
 */
export function BetaBracketTree({
  rounds,
  onProof,
}: {
  rounds: TreeRound[];
  onProof: (m: MatchRow) => void;
}) {
  const ys: number[][] = [];
  rounds.forEach((r, ri) => {
    if (ri === 0) {
      ys.push(r.items.map((_, i) => TOP + i * PITCH));
    } else {
      const prev = ys[ri - 1];
      ys.push(
        r.items.map((_, i) => {
          const a = prev[i * 2];
          const b = prev[i * 2 + 1] ?? a;
          return (a + b) / 2;
        })
      );
    }
  });

  const cols = rounds.length + 1; // + champion column
  const width = PAD * 2 + cols * CARD_W + (cols - 1) * GAP;
  const height = TOP + rounds[0].items.length * PITCH + 12;
  const xOf = (ri: number) => PAD + ri * (CARD_W + GAP);

  const finalMatch = rounds[rounds.length - 1].items[0];
  const finalWinner = winnerOf(finalMatch);
  const champion =
    finalWinner === "A"
      ? finalMatch.sideALabel
      : finalWinner === "B"
        ? finalMatch.sideBLabel
        : null;
  const champY = ys[ys.length - 1][0];

  const paths: string[] = [];
  rounds.forEach((r, ri) => {
    const nextYs = ys[ri + 1];
    r.items.forEach((_, i) => {
      const x1 = xOf(ri) + CARD_W;
      const y1 = ys[ri][i] + CARD_H / 2;
      const x2 = xOf(ri + 1);
      const target = nextYs ? nextYs[Math.floor(i / 2)] : champY;
      const y2 = target + CARD_H / 2;
      const mx = x1 + GAP / 2;
      paths.push(`M${x1} ${y1}H${mx}V${y2}H${x2}`);
    });
  });

  const side = (
    label: string,
    won: boolean,
    decided: boolean,
    isBye: boolean
  ) => (
    <div
      className={`bx-m-side ${won ? "is-won" : ""} ${
        decided && !won ? "is-lost" : ""
      }`}
    >
      <i className="bx-m-tag" style={{ background: tagColor(label) }}>
        {initials(label)}
      </i>
      <span className={`bx-m-name ${isBye ? "is-bye" : ""}`}>{label}</span>
      {won && <span className="bx-m-win">W</span>}
    </div>
  );

  return (
    <div className="bx-tree-scroll">
      <div className="bx-tree" style={{ width, height }}>
        <svg className="bx-tree-lines" width={width} height={height} aria-hidden="true">
          {paths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </svg>

        {rounds.map((r, ri) => (
          <div key={r.round}>
            <div className="bx-tree-label" style={{ left: xOf(ri), top: 12 }}>
              {roundTitle(ri, rounds.length)}
            </div>
            {r.items.map((m, i) => {
              const w = winnerOf(m);
              return (
                <div
                  key={m.id}
                  className={`bx-m ${ri === rounds.length - 1 ? "is-final" : ""}`}
                  style={{ left: xOf(ri), top: ys[ri][i], width: CARD_W, height: CARD_H }}
                >
                  {side(m.sideALabel, w === "A", w !== null, false)}
                  {side(m.sideBLabel, w === "B", w !== null, m.isBye)}
                  {m.proofUrl && (
                    <button
                      type="button"
                      className="bx-m-proof"
                      onClick={() => onProof(m)}
                      aria-label={`View proof for match ${m.weekMatchNumber}`}
                      title="View proof"
                    >
                      <ImageIcon className="bx-ic" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div className="bx-tree-label is-gold" style={{ left: xOf(rounds.length), top: 12 }}>
          Champion
        </div>
        <div
          className={`bx-champ ${champion ? "is-set" : ""}`}
          style={{ left: xOf(rounds.length), top: champY, width: CARD_W, height: CARD_H }}
        >
          {champion || "To be decided"}
        </div>
      </div>
    </div>
  );
}
