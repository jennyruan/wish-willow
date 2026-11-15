import Svg, { Ellipse, Path } from "react-native-svg";

const BRANCHES = [-90, -65, -40, -15, 10, 35, 60, 85];

export function WillowTree({ size = 240 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Ellipse cx={100} cy={188} rx={70} ry={8} fill="#C9DDBE" />
      <Path
        d="M94 188 C96 160 92 130 98 100 L102 100 C108 130 104 160 106 188 Z"
        fill="#7A5A3A"
      />
      <Ellipse cx={100} cy={70} rx={62} ry={42} fill="#7FAF62" />
      {BRANCHES.map((dx) => (
        <Path
          key={dx}
          d={`M${100 + dx * 0.55} 72 C${100 + dx * 0.7} 110 ${100 + dx * 0.85} 140 ${100 + dx * 0.9} 165`}
          stroke="#5E8F45"
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
        />
      ))}
    </Svg>
  );
}
