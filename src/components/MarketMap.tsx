"use client";

import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from "d3-geo";
import { useEffect, useRef } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import land from "world-atlas/land-110m.json";
import type { Target } from "@/lib/types";
import { evaluate } from "@/lib/warrant";

const topology = land as unknown as Topology<{ land: GeometryCollection }>;
const LAND = feature(topology, topology.objects.land);
const GRATICULE = geoGraticule10();

const center = (targets: Target[]): [number, number] => {
  if (targets.length === 0) return [-98, 38];
  const lon = targets.reduce((sum, target) => sum + target.lon, 0) / targets.length;
  const lat = targets.reduce((sum, target) => sum + target.lat, 0) / targets.length;
  return [lon, lat];
};

export function MarketMap({ targets }: { targets: Target[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const arrivals = useRef(new Map<string, number>());
  const view = useRef({ lon: -60, lat: 20, zoom: 1 });

  useEffect(() => {
    const node = canvas.current;
    const ctx = node?.getContext("2d");
    if (!node || !ctx) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [focusLon, focusLat] = center(targets);
    const spread = Math.max(0, ...targets.map((target) => geoDistance([target.lon, target.lat], [focusLon, focusLat])));
    const focusZoom = targets.length === 0 ? 1 : spread < 0.5 ? 2.2 : spread < 0.9 ? 1.6 : 1;
    let frame = 0;

    const draw = (now: number) => {
      const box = node.getBoundingClientRect();
      const ratio = devicePixelRatio || 1;
      if (node.width !== Math.round(box.width * ratio)) {
        node.width = Math.round(box.width * ratio);
        node.height = Math.round(box.height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, box.width, box.height);

      const pull = still ? 1 : 0.035;
      const current = view.current;
      current.lon += (focusLon - current.lon) * pull;
      current.lat += (focusLat - current.lat) * pull;
      current.zoom += (focusZoom - current.zoom) * pull;

      const radius = (Math.min(box.width, box.height) / 2 - 20) * current.zoom;
      const projection = geoOrthographic()
        .translate([box.width / 2, box.height / 2])
        .scale(radius)
        .rotate([-current.lon, -current.lat])
        .clipAngle(90);
      const path = geoPath(projection, ctx);

      ctx.beginPath();
      path({ type: "Sphere" });
      ctx.fillStyle = "#0e0e18";
      ctx.fill();
      ctx.strokeStyle = "rgba(139, 92, 246, .45)";
      ctx.stroke();

      ctx.beginPath();
      path(GRATICULE);
      ctx.strokeStyle = "rgba(255, 255, 255, .05)";
      ctx.stroke();

      ctx.beginPath();
      path(LAND);
      ctx.fillStyle = "#23233a";
      ctx.fill();
      ctx.strokeStyle = "#3b3b5c";
      ctx.stroke();

      const hub: [number, number] = [focusLon, focusLat];
      for (const target of targets) {
        if (!arrivals.current.has(target.id)) arrivals.current.set(target.id, now);
        const point: [number, number] = [target.lon, target.lat];
        const age = (now - (arrivals.current.get(target.id) ?? now)) / 1200;
        const progress = still ? 1 : Math.min(1, age);
        const passed = evaluate(target).passed;
        const color = passed ? "#34d399" : "#fb7185";

        if (progress < 1) {
          const eased = progress * progress * (3 - 2 * progress);
          const route = geoInterpolate(hub, point);
          const head = route(eased);
          ctx.beginPath();
          path({ type: "LineString", coordinates: [hub, head] });
          ctx.strokeStyle = "rgba(139, 92, 246, .75)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.lineWidth = 1;
          const dot = projection(head);
          if (dot) {
            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = "#8b5cf6";
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(dot[0], dot[1], 3.5, 0, 6.3);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
          continue;
        }

        if (geoDistance(point, [current.lon, current.lat]) > Math.PI / 2) continue;
        const spot = projection(point);
        if (!spot) continue;
        ctx.fillStyle = color;
        ctx.globalAlpha = passed ? 1 : 0.55;
        ctx.shadowColor = color;
        ctx.shadowBlur = passed ? 18 : 0;
        ctx.beginPath();
        ctx.arc(spot[0], spot[1], passed ? 6 : 4, 0, 6.3);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [targets]);

  return <canvas ref={canvas} aria-label="Globe of target locations" />;
}
