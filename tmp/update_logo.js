const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "src", "components", "member", "PremiumClassCard.tsx");
let content = fs.readFileSync(filePath, "utf8");

const newLogoMark = `export function PremiumLogoMark({ className = "" }: { className?: string }) {
  return (
    <div className={\`flex flex-col items-center justify-center py-4 \${className}\`} aria-label="Cloud & Core Logo">
      <h2 
        className="text-[#0B1D3A] font-medium tracking-wide text-3xl sm:text-[34px] leading-none" 
        style={{ fontFamily: "'Playfair Display', 'Bodoni MT', 'Didot', 'Times New Roman', serif" }}
      >
        Cloud &amp; Core
      </h2>
      <div className="flex items-center gap-2 mt-4">
        <div className="h-[1px] w-12 sm:w-16 bg-[#0B1D3A]"></div>
        <div className="w-1 h-1 rounded-full bg-[#0B1D3A]"></div>
        <div className="h-[1px] w-12 sm:w-16 bg-[#0B1D3A]"></div>
      </div>
      <div className="w-36 sm:w-48 h-[1px] bg-[#D4AF6A]/50 mt-3"></div>
    </div>
  );
}`;

content = content.replace(
  /export function PremiumLogoMark[\s\S]*?(?=export function MemberEmptyState)/,
  newLogoMark + "\n\n",
);

fs.writeFileSync(filePath, content);
console.log("PremiumClassCard.tsx updated with typographic logo.");
