import type { Config } from "tailwindcss";

const config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand:        { DEFAULT: "#003366", hover: "#00284F", soft: "#EBF1F6" },
        accent:       { DEFAULT: "#996600", soft: "#F7F1E6" },
        yellow:       "#CC9900",
        link:         "#2B6297",
        ink:          "#14212B",
        muted:        "#5A6771",
        faint:        "#8C8F90",
        line:         { DEFAULT: "#D6DDE2", subtle: "#E8ECEF", strong: "#BFC9D0" },
        surface:      "#FFFFFF",
        page:         "#FAFBFC",
        success:      "#009A61",
        warning:      "#FAA61A",
        danger:       "#ED1B2F",
        wine:         "#7C2348",
        teal:         { deep: "#003E4E", mid: "#00B08D" },
        cyan:         "#63CAE1",
        orange:       "#FAA61A",
      },
      fontFamily: {
        sans: ["Muli", "Mulish", "Arial", "Helvetica Neue", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "12px", control: "8px", sheet: "16px" },
      transitionTimingFunction: { brand: "cubic-bezier(.2,0,0,1)" },
      boxShadow: {
        hover: "0 1px 2px rgba(0,51,102,.06)",
        raised: "0 8px 24px rgba(0,51,102,.08)",
      },
    },
  },
} satisfies Config;

export default config;
