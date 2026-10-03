export interface Theme {
	id: string;
	label: string;
	emoji: string;
}

export const characters: Theme[] = [
	{ id: "car", label: "Car", emoji: "\u{1F697}" },
	{ id: "pony", label: "Pony", emoji: "\u{1F434}" },
	{ id: "unicorn", label: "Unicorn", emoji: "\u{1F984}" },
	{ id: "dragon", label: "Dragon", emoji: "\u{1F409}" },
	{ id: "cat", label: "Cat", emoji: "\u{1F431}" },
	{ id: "dog", label: "Dog", emoji: "\u{1F436}" },
	{ id: "butterfly", label: "Butterfly", emoji: "\u{1F98B}" },
	{ id: "robot", label: "Robot", emoji: "\u{1F916}" },
	{ id: "dinosaur", label: "Dinosaur", emoji: "\u{1F995}" },
	{ id: "mermaid", label: "Mermaid", emoji: "\u{1F9DC}" },
	{ id: "princess", label: "Princess", emoji: "\u{1F478}" },
	{ id: "pirate", label: "Pirate", emoji: "\u{1F3F4}\u{200D}\u{2620}\u{FE0F}" },
];

export const landscapes: Theme[] = [
	{ id: "forest", label: "Forest", emoji: "\u{1F332}" },
	{ id: "beach", label: "Beach", emoji: "\u{1F3D6}\u{FE0F}" },
	{ id: "castle", label: "Castle", emoji: "\u{1F3F0}" },
	{ id: "space", label: "Space", emoji: "\u{1F680}" },
	{ id: "underwater", label: "Underwater", emoji: "\u{1F30A}" },
	{ id: "garden", label: "Garden", emoji: "\u{1F33B}" },
	{ id: "mountains", label: "Mountains", emoji: "\u{26F0}\u{FE0F}" },
	{ id: "candy-land", label: "Candy Land", emoji: "\u{1F36D}" },
];

export function findTheme(list: Theme[], id: string | null | undefined): Theme | undefined {
	return list.find((t) => t.id === id);
}
