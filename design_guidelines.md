{
  "app_name": {
    "full": "VRoid Companion Studio",
    "short_mark": "VCS",
    "mark_treatment": {
      "concept": "Compact monogram for HUD + tab icon: VCS inside a rounded-rect ‘capsule’ with a thin outline and a single accent notch (like a camera focus bracket).",
      "usage": [
        "Top-left app chrome",
        "Viewport HUD watermark (very low opacity)",
        "Project thumbnails corner badge"
      ]
    }
  },
  "brand_attributes": [
    "Creator-first (fast iteration, minimal friction)",
    "Premium studio tool (Blender/Live2D-like density, but calmer)",
    "Anime/VTuber personality (playful accents, not childish)",
    "Performance-aware (UI stays out of the viewport)",
    "Trustworthy AI lab (clear states, quotas, undo)"
  ],
  "inspiration_references": {
    "products_to_channel": [
      {
        "name": "Live2D Cubism (dark theme + dockable palettes)",
        "why": "Dense creator UI with panels, tabs, and workspace mental model."
      },
      {
        "name": "Blender (viewport-first + overlays)",
        "why": "Viewport is the star; overlays are subtle and contextual."
      },
      {
        "name": "VRoid Studio (anime creator vibe)",
        "why": "Anime-specific microcopy and creator-friendly controls."
      }
    ],
    "search_notes": {
      "vtuber_creator_tools": "Live2D Cubism supports dark theme and custom workspaces; use this as a mental model for dockable panels and saved layouts.",
      "dark_mode_best_practices": "Prefer near-black surfaces, elevation via lighter surfaces, and desaturated accents for readability."
    }
  },
  "design_personality": {
    "style_fusion": [
      "Studio-tool density (Blender/Live2D)",
      "HUD overlays (camera/AR UI)",
      "Soft neon accents (teal/mint + coral) with restrained glow",
      "Subtle grain/noise for premium tactility"
    ],
    "do_not": [
      "No purple-forward AI aesthetic",
      "No giant gradients covering reading areas",
      "No ‘centered landing page’ layout",
      "No glossy skeuomorphic chrome"
    ]
  },
  "typography": {
    "google_fonts": {
      "display": {
        "family": "Space Grotesk",
        "weights": [400, 500, 600, 700],
        "usage": "Headings, panel titles, HUD labels"
      },
      "body": {
        "family": "IBM Plex Sans",
        "weights": [400, 500, 600],
        "usage": "Body, forms, property labels, microcopy"
      },
      "mono": {
        "family": "IBM Plex Mono",
        "weights": [400, 500],
        "usage": "File names, VRM metadata, shortcuts, numeric readouts"
      }
    },
    "tailwind_font_setup": {
      "note": "Main agent should add these to index.html <link> or via @import in index.css; then extend tailwind.config fontFamily.",
      "font_family_tokens": {
        "--font-display": "Space Grotesk, ui-sans-serif, system-ui",
        "--font-body": "IBM Plex Sans, ui-sans-serif, system-ui",
        "--font-mono": "IBM Plex Mono, ui-monospace, SFMono-Regular"
      }
    },
    "type_scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight",
      "h2": "text-base md:text-lg font-medium text-muted-foreground",
      "panel_title": "text-sm font-semibold tracking-wide",
      "property_label": "text-xs font-medium text-muted-foreground",
      "body": "text-sm md:text-base",
      "mono_small": "text-xs font-medium font-mono"
    },
    "line_height": {
      "dense_ui": "leading-5",
      "reading": "leading-6"
    }
  },
  "color_system": {
    "mode": "dark-first (no light mode required)",
    "palette_hex": {
      "bg_0": "#0B0D10",
      "bg_1": "#0F1318",
      "surface_0": "#121923",
      "surface_1": "#172231",
      "surface_2": "#1B2A3B",
      "border": "#243447",
      "text": "#EAF0F7",
      "text_muted": "#A9B6C6",
      "text_faint": "#7F8EA1",
      "primary_teal": "#2FE6D0",
      "primary_teal_dim": "#1FB8A8",
      "accent_mint": "#7CFFB2",
      "accent_coral": "#FF8A7A",
      "accent_amber": "#FFC46B",
      "danger": "#FF4D6D",
      "success": "#2EE59D",
      "info": "#66B7FF",
      "focus_ring": "#66F2E1"
    },
    "semantic_tokens": {
      "--bg": "var(--vcs-bg-0)",
      "--panel": "var(--vcs-surface-0)",
      "--panel-2": "var(--vcs-surface-1)",
      "--border": "var(--vcs-border)",
      "--text": "var(--vcs-text)",
      "--muted": "var(--vcs-text-muted)",
      "--primary": "var(--vcs-primary-teal)",
      "--accent": "var(--vcs-accent-coral)",
      "--ring": "var(--vcs-focus-ring)",
      "--danger": "var(--vcs-danger)",
      "--success": "var(--vcs-success)",
      "--warning": "var(--vcs-accent-amber)",
      "--info": "var(--vcs-info)"
    },
    "shadcn_hsl_mapping": {
      "note": "Main agent should replace current :root/.dark HSL tokens in index.css with these (dark only).",
      "dark": {
        "--background": "215 33% 5%",
        "--foreground": "210 33% 96%",
        "--card": "214 33% 9%",
        "--card-foreground": "210 33% 96%",
        "--popover": "214 33% 9%",
        "--popover-foreground": "210 33% 96%",
        "--primary": "174 78% 55%",
        "--primary-foreground": "215 33% 8%",
        "--secondary": "214 28% 14%",
        "--secondary-foreground": "210 33% 96%",
        "--muted": "214 22% 16%",
        "--muted-foreground": "214 14% 72%",
        "--accent": "8 100% 74%",
        "--accent-foreground": "215 33% 8%",
        "--destructive": "350 100% 65%",
        "--destructive-foreground": "210 33% 96%",
        "--border": "214 28% 22%",
        "--input": "214 28% 22%",
        "--ring": "174 90% 70%",
        "--radius": "0.75rem"
      }
    },
    "gradients": {
      "rule": "Use gradients only as large background accents (<=20% viewport). Never on text-heavy panels.",
      "allowed_background_accents": [
        {
          "name": "aurora-teal",
          "css": "radial-gradient(900px circle at 20% 10%, rgba(47,230,208,0.18), transparent 55%), radial-gradient(700px circle at 85% 20%, rgba(255,138,122,0.10), transparent 60%)"
        },
        {
          "name": "mint-haze",
          "css": "radial-gradient(800px circle at 70% 0%, rgba(124,255,178,0.12), transparent 55%), radial-gradient(900px circle at 10% 80%, rgba(102,183,255,0.10), transparent 60%)"
        }
      ]
    },
    "texture_noise": {
      "usage": "Apply subtle noise overlay on app background and viewport HUD panels.",
      "css_snippet": ".vcs-noise::before{content:\"\";position:absolute;inset:0;background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.18%22/%3E%3C/svg%3E');mix-blend-mode:overlay;pointer-events:none;border-radius:inherit;opacity:.35}"
    }
  },
  "spacing_and_layout": {
    "spacing_scale_px": {
      "2": 8,
      "3": 12,
      "4": 16,
      "5": 20,
      "6": 24,
      "8": 32,
      "10": 40,
      "12": 48
    },
    "radii": {
      "panel": "rounded-xl",
      "control": "rounded-lg",
      "pill": "rounded-full"
    },
    "grid": {
      "studio_shell": {
        "desktop": "CSS grid: [leftbar 64px] [viewport 1fr] [rightpanel 360px] with bottom dock 220px (collapsible)",
        "tablet": "Right panel becomes Drawer/Sheet; bottom dock becomes Tabs",
        "mobile": "Viewport full; left tools become bottom nav; properties open as Drawer"
      },
      "projects_page": {
        "grid": "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4",
        "card_ratio": "aspect-[16/10]"
      }
    }
  },
  "elevation_and_effects": {
    "shadows": {
      "panel": "shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
      "floating": "shadow-[0_18px_60px_rgba(0,0,0,0.55)]",
      "inset": "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
    },
    "glow": {
      "teal": "shadow-[0_0_0_1px_rgba(47,230,208,0.25),0_0_24px_rgba(47,230,208,0.12)]",
      "coral": "shadow-[0_0_0_1px_rgba(255,138,122,0.22),0_0_24px_rgba(255,138,122,0.10)]"
    },
    "borders": {
      "hairline": "border border-border/80",
      "hud": "border border-white/10"
    }
  },
  "components": {
    "component_path": {
      "button": "/app/frontend/src/components/ui/button.jsx",
      "card": "/app/frontend/src/components/ui/card.jsx",
      "tabs": "/app/frontend/src/components/ui/tabs.jsx",
      "slider": "/app/frontend/src/components/ui/slider.jsx",
      "select": "/app/frontend/src/components/ui/select.jsx",
      "dialog": "/app/frontend/src/components/ui/dialog.jsx",
      "sheet": "/app/frontend/src/components/ui/sheet.jsx",
      "drawer": "/app/frontend/src/components/ui/drawer.jsx",
      "resizable": "/app/frontend/src/components/ui/resizable.jsx",
      "scroll_area": "/app/frontend/src/components/ui/scroll-area.jsx",
      "tooltip": "/app/frontend/src/components/ui/tooltip.jsx",
      "sonner_toast": "/app/frontend/src/components/ui/sonner.jsx",
      "skeleton": "/app/frontend/src/components/ui/skeleton.jsx",
      "dropdown_menu": "/app/frontend/src/components/ui/dropdown-menu.jsx",
      "menubar": "/app/frontend/src/components/ui/menubar.jsx",
      "context_menu": "/app/frontend/src/components/ui/context-menu.jsx",
      "collapsible": "/app/frontend/src/components/ui/collapsible.jsx",
      "toggle_group": "/app/frontend/src/components/ui/toggle-group.jsx",
      "switch": "/app/frontend/src/components/ui/switch.jsx",
      "textarea": "/app/frontend/src/components/ui/textarea.jsx",
      "input": "/app/frontend/src/components/ui/input.jsx",
      "progress": "/app/frontend/src/components/ui/progress.jsx",
      "carousel": "/app/frontend/src/components/ui/carousel.jsx",
      "calendar": "/app/frontend/src/components/ui/calendar.jsx"
    },
    "button_system": {
      "shape": "Glass / Neomorphic hybrid: rounded-lg, subtle inset highlight, crisp border",
      "variants": {
        "primary": {
          "tailwind": "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
          "micro_interaction": "hover: slight lift (translateY -1px) + glow; active: scale-95"
        },
        "secondary": {
          "tailwind": "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/80",
          "micro_interaction": "hover: border brightens; active: scale-95"
        },
        "ghost": {
          "tailwind": "bg-transparent hover:bg-white/5 text-foreground",
          "micro_interaction": "hover: subtle background wash"
        },
        "danger": {
          "tailwind": "bg-[color:var(--vcs-danger)] text-white hover:opacity-90",
          "micro_interaction": "shake on destructive confirm (framer-motion)"
        }
      },
      "sizes": {
        "sm": "h-8 px-3 text-xs",
        "md": "h-9 px-4 text-sm",
        "lg": "h-10 px-5 text-sm"
      },
      "data_testid_examples": [
        "data-testid=\"studio-import-vrm-button\"",
        "data-testid=\"viewport-screenshot-button\"",
        "data-testid=\"texture-lab-generate-button\""
      ]
    },
    "panel_patterns": {
      "right_properties_panel": {
        "structure": [
          "Tabs: Animation / Expressions / Pose / Materials / Lighting",
          "Each tab: ScrollArea with section Cards",
          "Sections use Collapsible for density"
        ],
        "tailwind_container": "bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/55 border border-border/80 rounded-xl",
        "header": "sticky top-0 z-10 bg-card/60 backdrop-blur border-b border-border/70"
      },
      "left_toolbar": {
        "concept": "Icon-only vertical rail with tooltips; expands on hover to show labels (desktop).",
        "tailwind": "w-14 bg-[color:var(--vcs-surface-0)]/70 border-r border-border/70",
        "items": [
          "Import VRM",
          "Animation",
          "Texture Lab",
          "Reference Studio",
          "Projects",
          "Settings"
        ]
      },
      "bottom_dock": {
        "concept": "Timeline + clip presets + recent textures strip. Collapsible to a 44px handle.",
        "tailwind": "bg-card/60 backdrop-blur border-t border-border/70",
        "interaction": "Drag height via Resizable; double-click handle to collapse/expand"
      }
    },
    "viewport_hud": {
      "goal": "Controls feel like a camera HUD: minimal, translucent, never blocking the model.",
      "overlays": [
        {
          "name": "top_hud_bar",
          "contents": ["Project name", "Unsaved dot", "FPS/tri count", "Quick actions"],
          "tailwind": "pointer-events-auto inline-flex items-center gap-2 rounded-full bg-black/35 backdrop-blur px-3 py-2 border border-white/10"
        },
        {
          "name": "right_quick_stack",
          "contents": ["Orbit", "Pan", "Reset camera", "Lighting preset"],
          "tailwind": "flex flex-col gap-2"
        },
        {
          "name": "bottom_capture",
          "contents": ["Screenshot", "Record", "Background"],
          "tailwind": "rounded-xl bg-black/35 backdrop-blur border border-white/10 p-2"
        }
      ],
      "empty_state": {
        "title": "Drop a .vrm to begin",
        "body": "Import a VRM file to preview animations, tweak expressions, and generate anime textures.",
        "cta": "Import VRM",
        "secondary": "Open sample project",
        "visual": "Dashed dropzone + subtle animated scanline"
      }
    },
    "forms_and_controls": {
      "sliders": {
        "use": "Expression blendshapes + bone pose",
        "pattern": "Label row (left) + numeric value (mono) + Slider",
        "tailwind": "space-y-2",
        "data_testid": "expression-slider-smile"
      },
      "material_slot_picker": {
        "use": "Apply generated texture to VRM material slots",
        "components": ["Select", "Card", "AspectRatio"],
        "pattern": "Left: slot list; Right: preview + Apply button"
      }
    },
    "gallery_patterns": {
      "projects_grid": {
        "card": "Card with thumbnail, name, last edited, quick actions (open/duplicate/delete)",
        "hover": "thumbnail zoom 1.02 + border glow",
        "data_testid": "project-card"
      },
      "texture_gallery": {
        "component": "Carousel for recent + grid for all",
        "actions": ["Apply", "Download", "Set as reference"],
        "loading": "Skeleton tiles with shimmer"
      }
    }
  },
  "motion_and_microinteractions": {
    "libraries": {
      "framer_motion": {
        "install": "npm i framer-motion",
        "usage": "Panel open/close, collapsible sections, toast entrance, subtle hover lift"
      }
    },
    "principles": [
      "Fast UI: 120–180ms for hover, 180–240ms for panel transitions",
      "Use easing: cubic-bezier(0.2, 0.8, 0.2, 1)",
      "Never animate layout on the 3D canvas itself; animate surrounding UI only"
    ],
    "interaction_specs": {
      "toolbar_expand": "On hover (desktop): width 56px -> 180px with opacity fade for labels",
      "panel_sections": "Collapsible chevron rotates 90deg; content height animates",
      "apply_texture": "On apply: brief teal pulse ring around viewport + toast confirmation",
      "recording": "Record button toggles to coral with subtle breathing animation"
    }
  },
  "states": {
    "loading": {
      "vrm_loading": "Viewport shows centered Skeleton + ‘Parsing VRM…’ + progress bar; keep background interactive disabled",
      "ai_generation": "Texture tiles show Skeleton; right panel shows Progress with step labels: ‘Drafting → Detailing → Exporting’"
    },
    "empty": {
      "no_textures": "Show 3-card tips: ‘Use a reference’, ‘Try cel-shaded prompts’, ‘Apply to material slots’",
      "no_projects": "Show CTA: ‘Create your first project’ + sample templates"
    },
    "error": {
      "toast": "Use Sonner with concise title + action (Retry / View logs)",
      "inline": "Use Alert component inside panels for recoverable errors"
    },
    "microcopy": {
      "quota": "“You’re out of renders for now. Save your project and try again after reset.”",
      "bad_prompt": "“Try describing materials (silk, denim), lighting (soft rim), and palette (teal + coral accents).”",
      "vrm_invalid": "“This file doesn’t look like a valid VRM. Try exporting again from VRoid Studio.”"
    }
  },
  "accessibility": {
    "contrast": "All text on surfaces must meet WCAG AA; prefer text (#EAF0F7) on bg (#0B0D10) and muted (#A9B6C6) only for secondary labels.",
    "focus": "Always visible focus ring using --ring; avoid removing outlines.",
    "keyboard_shortcuts": {
      "examples": [
        "I: Import VRM",
        "G: Generate texture",
        "R: Start/stop recording",
        "F: Frame character",
        "Ctrl/Cmd+S: Save project"
      ],
      "ui": "Show shortcuts in Tooltip content and in a Command palette"
    },
    "reduced_motion": "Respect prefers-reduced-motion: disable breathing/pulsing and reduce panel animation distance"
  },
  "extra_libraries": {
    "3d": {
      "three": "three",
      "r3f": "@react-three/fiber",
      "drei": "@react-three/drei",
      "vrm": "@pixiv/three-vrm",
      "notes": "Use OrbitControls from drei; keep render loop efficient; throttle expensive UI updates."
    },
    "command_palette": {
      "component": "shadcn Command",
      "path": "/app/frontend/src/components/ui/command.jsx",
      "usage": "Quick actions + search settings + show shortcuts"
    }
  },
  "layout_blueprints": {
    "studio_main": {
      "regions": {
        "left": "ToolRail (Collapsible)",
        "center": "Viewport (dominant) + HUD overlays",
        "right": "PropertiesPanel (Tabs + ScrollArea)",
        "bottom": "Dock (Resizable): Timeline/Clips + Recent textures"
      },
      "resizable": {
        "use": "shadcn Resizable",
        "behavior": "Right panel resizable 320–420px; bottom dock 120–320px"
      }
    },
    "projects_page": {
      "header": "Search + sort + New Project button",
      "content": "Grid of project cards",
      "details": "Right-click ContextMenu for duplicate/delete"
    },
    "settings_drawer": {
      "use": "shadcn Drawer/Sheet",
      "sections": ["Lighting", "Background", "Camera presets", "Performance"]
    }
  },
  "image_urls": {
    "hero_or_onboarding": [
      {
        "url": "https://images.pexels.com/photos/36389508/pexels-photo-36389508.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "category": "onboarding",
        "description": "Creator desk vibe for onboarding/empty state illustration (use as blurred background behind copy)."
      }
    ],
    "hud_or_tech_mood": [
      {
        "url": "https://images.unsplash.com/photo-1660144425546-b07680e711d1?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
        "category": "mood",
        "description": "Tech/HUD mood image for marketing page or splash screen (optional)."
      }
    ],
    "texture_lab_mood": [
      {
        "url": "https://images.unsplash.com/photo-1650406262076-c3444b5be6f6?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
        "category": "texture",
        "description": "Abstract fabric texture reference for Texture Lab empty state tiles (use as placeholder)."
      }
    ]
  },
  "instructions_to_main_agent": {
    "global_css": [
      "Remove default CRA-like App.css centering patterns; do not center the whole app.",
      "Replace shadcn tokens in index.css .dark with the provided HSL mapping; keep dark mode as default by adding class 'dark' on html/body.",
      "Add CSS variables for VCS palette (hex) and optional noise utility class.",
      "Avoid transition: all; only transition colors/opacity/shadow on interactive elements."
    ],
    "react_structure_js": [
      "Use .js components (not .tsx).",
      "Create StudioShell layout using CSS grid + shadcn Resizable for right/bottom panels.",
      "Viewport should be a single canvas region with absolute-positioned HUD overlays (pointer-events: none on wrapper; enable on controls).",
      "All buttons/inputs/sliders/tabs/menu items must include data-testid in kebab-case."
    ],
    "testing_ids": {
      "must_have": [
        "studio-viewport-canvas",
        "studio-import-vrm-button",
        "studio-animation-clip-select",
        "studio-expression-slider-smile",
        "texture-lab-generate-button",
        "texture-lab-reference-upload-input",
        "projects-grid",
        "settings-open-button"
      ]
    }
  },
  "append_general_ui_ux_design_guidelines": "<General UI UX Design Guidelines>\n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
