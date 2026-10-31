// Add your javascript here

const stickyClasses = ["fixed", "h-14"];
const unstickyClasses = ["absolute", "h-20"];
const stickyClassesContainer = [
	"border-neutral-300/50",
	"bg-white/80",
	"dark:border-neutral-600/40",
	"dark:bg-neutral-900/60",
	"backdrop-blur-2xl",
];
const unstickyClassesContainer = ["border-transparent"];
let headerElement = null;

document.addEventListener("DOMContentLoaded", () => {
	headerElement = document.getElementById("header");

	stickyHeaderFuncionality();
	evaluateHeaderPosition();
	mobileMenuFunctionality();
});

window.stickyHeaderFuncionality = () => {
	window.addEventListener("scroll", () => {
		evaluateHeaderPosition();
	});
};

window.evaluateHeaderPosition = () => {
	if (window.scrollY > 16) {
		headerElement.firstElementChild.classList.add(...stickyClassesContainer);
		headerElement.firstElementChild.classList.remove(...unstickyClassesContainer);
		headerElement.classList.add(...stickyClasses);
		headerElement.classList.remove(...unstickyClasses);
		document.getElementById("menu").classList.add("top-[56px]");
		document.getElementById("menu").classList.remove("top-[75px]");
	} else {
		headerElement.firstElementChild.classList.remove(...stickyClassesContainer);
		headerElement.firstElementChild.classList.add(...unstickyClassesContainer);
		headerElement.classList.add(...unstickyClasses);
		headerElement.classList.remove(...stickyClasses);
		document.getElementById("menu").classList.remove("top-[56px]");
		document.getElementById("menu").classList.add("top-[75px]");
	}
};

document.getElementById("darkToggle").addEventListener("click", () => {
	document.documentElement.classList.add("duration-300");

	// Save an explicit choice so it overrides the system setting from now on
	if (document.documentElement.classList.contains("dark")) {
		localStorage.setItem("dark_mode", false);
		switchTheme(false);
	} else {
		localStorage.setItem("dark_mode", true);
		switchTheme(true);
	}
});

// The toggle shows what clicking it does (a moon in light mode, a sun in dark mode). Which icon
// and label are visible is handled by `dark:` classes in header.astro; this only animates the
// current icon setting and the next one rising.
function switchTheme(dark) {
	const leaving = document.getElementById(dark ? "moon" : "sun");
	const arriving = document.getElementById(dark ? "sun" : "moon");

	arriving.classList.remove("setting");
	leaving.classList.remove("rising");
	leaving.classList.add("setting");

	setTimeout(() => {
		document.documentElement.classList.toggle("dark", dark);
		arriving.classList.add("rising");
	}, 500);
}

function mobileMenuFunctionality() {
	document.getElementById("openMenu").addEventListener("click", () => {
		openMobileMenu();
	});

	document.getElementById("closeMenu").addEventListener("click", () => {
		closeMobileMenu();
	});
}

window.openMobileMenu = () => {
	document.getElementById("openMenu").classList.add("hidden");
	document.getElementById("closeMenu").classList.remove("hidden");
	document.getElementById("menu").classList.remove("hidden");
	document.getElementById("mobileMenuBackground").classList.add("opacity-0");
	document.getElementById("mobileMenuBackground").classList.remove("hidden");

	setTimeout(() => {
		document.getElementById("mobileMenuBackground").classList.remove("opacity-0");
	}, 1);
};

window.closeMobileMenu = () => {
	document.getElementById("closeMenu").classList.add("hidden");
	document.getElementById("openMenu").classList.remove("hidden");
	document.getElementById("menu").classList.add("hidden");
	document.getElementById("mobileMenuBackground").classList.add("hidden");
};
