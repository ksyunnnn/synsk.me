precision mediump float;

/** @resolution */
uniform vec2 u_resolution;

/** @time */
uniform float u_time;

/**
 * @label Cycle (s)
 * @default 4.0
 * @range 1.0, 8.0
 */
uniform float u_cycle;

/**
 * @label Change (s)
 * @default 0.5
 * @range 0.2, 1.0
 */
uniform float u_change;

/**
 * @label Dot
 * @color
 * @default #A3A3A3
 */
uniform vec3 u_dot;

/**
 * @label Background
 * @color
 * @default #FFFFFF
 */
uniform vec3 u_bg;

void main() {
  vec2 p = gl_FragCoord.xy - 0.5 * u_resolution;
  float t = mod(u_time, u_cycle);
  float half_cycle = 0.5 * u_cycle;
  float grow = smoothstep(0.0, u_change, t);
  float shrink = smoothstep(half_cycle, half_cycle + u_change, t);
  float scale = 0.9 + 0.1 * (grow - shrink);
  float r = 24.0 * scale;
  float d = length(p) - r;
  float a = 1.0 - smoothstep(-1.0, 1.0, d);
  gl_FragColor = vec4(mix(u_bg, u_dot, a), 1.0);
}
