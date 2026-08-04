// CREATIVE STIMULUS ENGINE — THE 37-LENS LIBRARY
// Full content per the Phase 1 build spec. Format per lens:
// Name | Approach | Core Provocation | Sub-Prompts | Format Tags
//
// Real-world reference examples link OUT to the original public source
// (a YouTube search for the named, real campaign). Nothing is hosted or
// embedded here — the reference companion document remains the canonical
// commentary; these are resolvable jump-off links for the Tissue Check UI.

export type StimulusLens = {
  id: string;
  name: string;
  approach: string;
  provocation: string;
  subPrompts: string;
  formatTags: string[];
  /** Verified real, named campaigns (web-confirmed Aug 2026). Link out to public source; never embedded. */
  references: { label: string; url: string }[];
};

function ref(label: string): { label: string; url: string } {
  return {
    label,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(
      `${label} advert campaign`,
    )}`,
  };
}

export const STIMULUS_LENSES: StimulusLens[] = [
  {
    id: "silent_proof",
    name: "The Silent Proof",
    approach: "Visual metaphor · Zero language",
    provocation:
      "If zero words — spoken or written — were available to respond to this brief, what single image or sequence of images proves the proposition is undeniably true.",
    subPrompts:
      "What if the ad existed without colour. What if the brand's shape alone carried the entire argument. What if emojis and symbols were the only language available.",
    formatTags: ["Outdoor", "Film", "Print", "Social"],
    references: [ref("Coca-Cola Hilltop"), ref("Sony Bravia Balls"), ref("McDonald's Follow the Arches")],
  },
  {
    id: "famous_face",
    name: "The Famous Face",
    approach: "Celebrity as brand amplifier",
    provocation:
      "Which specific celebrity most powerfully embodies the contradiction at the centre of this proposition. What do they do that makes the brand become the celebrity rather than the celebrity becoming the brand.",
    subPrompts:
      "What if the celebrity were used completely against type. What if the humour, absurdity, or vulnerability of the casting were the entire idea.",
    formatTags: ["Film", "Social", "Audio"],
    references: [ref("Snickers You're Not You When You're Hungry Joe Pesci"), ref("Nike Dream Crazy Colin Kaepernick"), ref("Old Spice The Man Your Man Could Smell Like")],
  },
  {
    id: "impossible_world",
    name: "The Impossible World",
    approach: "Surrealism · Illogic resolved by brand truth",
    provocation:
      "Build a world where the most illogical things are true. Then reveal why the brand is the only logical response to that world.",
    subPrompts:
      "What if gravity did not exist. What if animals used human products. What if buildings could communicate. What if two entirely unrelated products were blended into one. What if everyday objects could talk.",
    formatTags: ["Film", "Social", "Experiential"],
    references: [ref("Skittles Touch the Rainbow"), ref("Cadbury Gorilla"), ref("Guinness noitulovE")],
  },
  {
    id: "brand_anthem",
    name: "The Brand Anthem",
    approach: "Music and sound as brand idea",
    provocation:
      "If the proposition cannot be said because it has been said too many times, what unique musical story carries it instead. What is the hook, the emotional register, and what makes it impossible to forget.",
    subPrompts:
      "What does this brand sound like when the proposition is true. What sonic signature belongs exclusively to this brand in this specific channel moment.",
    formatTags: ["Audio", "Film", "Social"],
    references: [ref("Qantas I Still Call Australia Home"), ref("Intel Bong sonic logo"), ref("John Lewis Christmas soundtrack")],
  },
  {
    id: "living_series",
    name: "The Living Series",
    approach: "Narrative universe · Multiple episodes",
    provocation:
      "Can this proposition sustain its own action, drama, or comedy series. What is the conflict. Who are the characters. What do audiences want to happen next and why does the brand determine the outcome.",
    subPrompts:
      "What if the series told its story in reverse. What if the characters were drawn directly from the specific audience this brief describes.",
    formatTags: ["Film", "Long-form", "Social"],
    references: [ref("BMW Films The Hire"), ref("Nescafe Gold Blend couple"), ref("Compare the Market Meerkats")],
  },
  {
    id: "undeniable_test",
    name: "The Undeniable Test",
    approach: "Product demonstration as creative proof",
    provocation:
      "What is the single most dramatic, unexpected, and visually compelling way to demonstrate the brand doing exactly what the proposition claims. Not describe it. Prove it in a way that cannot be disputed or ignored.",
    subPrompts:
      "What if the demonstration took place in an environment where it was least expected. What if the demonstration destroyed the thing it was proving in the process.",
    formatTags: ["Film", "Social", "Outdoor"],
    references: [ref("Volvo Trucks The Epic Split"), ref("Blendtec Will It Blend"), ref("Red Bull Stratos")],
  },
  {
    id: "absent_world",
    name: "The Absent World",
    approach: "Negative space · Brand removed from reality",
    provocation:
      "What does the world look like without this brand in it. How specifically does daily life change. What do people lose that they never noticed they had. Then bring the brand back and show what returns with it.",
    subPrompts:
      "What if a world without colour were the metaphor for a world without this brand. What if the absence were shown through the eyes of the people who miss it most.",
    formatTags: ["Film", "Outdoor", "Social"],
    references: [ref("Heineken Worlds Apart"), ref("Lego Rebuild the World"), ref("Coca-Cola brand removed packaging")],
  },
  {
    id: "environment_is_idea",
    name: "The Environment Is The Idea",
    approach: "Medium as message · Environment as demonstration",
    provocation:
      "Use the environment, location, or medium the work appears in to become the proof of the proposition. The idea does not appear in the medium. The idea is the medium.",
    subPrompts:
      "What if augmented reality made the environment itself the brand experience. What if the physical location of the ad were inseparable from what the ad says.",
    formatTags: ["Outdoor", "Experiential", "Digital"],
    references: [ref("British Airways Magic of Flying billboard"), ref("Pepsi Max Unbelievable bus shelter"), ref("Women's Aid Look At Me billboard")],
  },
  {
    id: "living_character",
    name: "The Living Character",
    approach: "Invented character as brand voice",
    provocation:
      "What character — human, animal, object, or total fantasy — speaks for this brand in a way no real person could. What is the single defining behaviour that makes the character impossible to separate from the brand.",
    subPrompts:
      "What if the character were the product itself given human qualities. What if the character existed in the real world as well as the advertising world.",
    formatTags: ["Film", "Social", "Long-form"],
    references: [ref("Geico Gecko"), ref("Michelin Man Bibendum"), ref("Aleksandr Orlov Compare the Meerkat")],
  },
  {
    id: "iconic_property",
    name: "The Iconic Property",
    approach: "Brand asset dramatised at scale",
    provocation:
      "Does this brand own a visual, verbal, sonic, or behavioural property that if given disproportionate creative weight becomes the proposition made physical. What happens when that property is treated as the most important thing in the world.",
    subPrompts:
      "Design a campaign inspired by what the brand already owns. What if the brand's most recognisable element were the entire idea without any supporting explanation.",
    formatTags: ["Outdoor", "Film", "Print"],
    references: [ref("McDonald's Golden Arches Follow the Arches"), ref("Coca-Cola contour bottle silhouette"), ref("Heinz Draw Ketchup")],
  },
  {
    id: "childs_version",
    name: "The Child's Version",
    approach: "Proposition seen through unlearned eyes",
    provocation:
      "Strip the brief of every complex word, every strategic construct, every adult assumption. What does this proposition mean to someone who has not yet learned to pretend it does not matter.",
    subPrompts:
      "Create an idea that appeals specifically to children but simultaneously captures adult attention in a completely different register.",
    formatTags: ["Film", "Social", "Outdoor"],
    references: [ref("John Lewis The Long Wait"), ref("Volkswagen The Force"), ref("Lego Let's Build")],
  },
  {
    id: "brand_story",
    name: "The Brand Story",
    approach: "Narrative · Conflict · Resolution",
    provocation:
      "Every brand has a story. What is the conflict at the heart of this one. Good versus evil. Hero versus villain. Progress versus establishment. Develop the plot, establish the adversity, and show why the brand is central to the resolution.",
    subPrompts:
      "What if the story were told in reverse. What if the conflict were visual rather than verbal — seen before it is heard.",
    formatTags: ["Film", "Long-form", "Social"],
    references: [ref("Apple 1984"), ref("Guinness Surfer"), ref("Nike Find Your Greatness")],
  },
  {
    id: "enormous_problem",
    name: "The Enormous Problem",
    approach: "Problem exaggerated to dramatic extremity",
    provocation:
      "What is wrong with the world that this brand can fix. Present the most dramatic, over-the-top expression of that problem. Then use the brand to solve it in the most satisfying possible way.",
    subPrompts:
      "What if the problem were so enormous it was visible from space. What if the person experiencing the problem were the last person anyone expected to encounter it.",
    formatTags: ["Film", "Social", "Outdoor"],
    references: [ref("Metro Trains Dumb Ways to Die"), ref("Snickers Betty White"), ref("Domestos germs campaign")],
  },
  {
    id: "unsung_human",
    name: "The Unsung Human",
    approach: "Everyday people made heroic",
    provocation:
      "Who is the ordinary person whose specific daily life most powerfully proves the proposition is true. Not exceptional. Not famous. Just specific and recognisable. What is the value of what they do that the brand recognises when no one else does.",
    subPrompts:
      "What if the hero were the person everyone overlooks. What if the recognition came from an unexpected source that made it impossible to dismiss.",
    formatTags: ["Film", "Social", "Long-form"],
    references: [ref("Procter & Gamble Thank You Mom"), ref("Guinness Wheelchair Basketball")],
  },
  {
    id: "other_dimension",
    name: "The Other Dimension",
    approach: "Alternative universe · Time · Place",
    provocation:
      "Transport the audience to a planet, place, or point in time — real or imaginary — where this proposition is the governing law of that world. Why does the audience want to stay. What does the brand do to make them belong there.",
    subPrompts:
      "Imagine a future where technology has advanced significantly — how does the brand live there. Imagine a society where time travel is possible. Create a world where gravity does not exist and the brand is the only logical response.",
    formatTags: ["Film", "Long-form", "Social"],
    references: [ref("Audi Spaceship"), ref("Chanel No 5 The One That I Want")],
  },
  {
    id: "origin",
    name: "The Origin",
    approach: "Brand history and provenance as creative territory",
    provocation:
      "Is there a moment in this brand's history — real or imagined — that makes the proposition feel inevitable. A decision made under pressure. A belief held when it was commercially inconvenient. That moment is the idea.",
    subPrompts:
      "What if the history were presented as a visual timeline that the audience could inhabit. What if the person who made the original decision were the narrator of what the brand has become.",
    formatTags: ["Film", "Long-form", "Social"],
    references: [ref("Johnnie Walker The Man Who Walked Around the World"), ref("Jack Daniel's Made in Lynchburg"), ref("Levi's Circles")],
  },
  {
    id: "cultural_signal",
    name: "The Cultural Signal",
    approach: "Topicality · Cultural moment",
    provocation:
      "What is happening in culture right now that this proposition speaks to directly. Not references. Not piggybacks. The brand arrives at exactly the moment the culture needs this specific truth and cannot pretend otherwise.",
    subPrompts:
      "Create a campaign that encourages people to unplug from technology and shows why the brand makes that possible. What if the brief answered today's most urgent cultural conversation directly.",
    formatTags: ["Social", "Outdoor", "PR"],
    references: [ref("Oreo Dunk in the Dark"), ref("Nike You Can't Stop Us"), ref("KFC FCK apology ad")],
  },
  {
    id: "human_motivation",
    name: "The Human Motivation",
    approach: "Reframe brand as emotional not functional",
    provocation:
      "Stop thinking of the brand as a thing. Think of it as a human motivation — hope, freedom, belonging, control, recognition. Express that motivation in its purest form without ever describing the product itself.",
    subPrompts:
      "Develop an idea that highlights the emotional benefits rather than the features. What if the brand existed only to satisfy one specific human need and that need were all it ever talked about.",
    formatTags: ["Film", "Outdoor", "Social"],
    references: [ref("Dove Real Beauty Sketches"), ref("Apple Think Different"), ref("Always Like A Girl")],
  },
  {
    id: "worthy_opponent",
    name: "The Worthy Opponent",
    approach: "Competitive challenge · Brand confidence",
    provocation:
      "In a brand versus the world confrontation, how does this brand perform. What if the biggest competitor were not another brand but mother nature, time, human weakness, or something totally unexpected. Take the challenge. Win it in a way only this brand could.",
    subPrompts:
      "What if the brand challenged a cultural norm rather than a competitor. What if losing the challenge proved the point more powerfully than winning it.",
    formatTags: ["Film", "Social", "Outdoor"],
    references: [ref("Avis We Try Harder"), ref("Burger King Whopper Detour"), ref("Pepsi Challenge")],
  },
  {
    id: "fear_inside",
    name: "The Fear Inside",
    approach: "Fear · FOMO · Consequences of inaction",
    provocation:
      "What specific danger, loss, or consequence does the audience face if they ignore what this brand offers. Create that fear and then show the brand as the hero, the saviour, or the loveable villain that resolves it.",
    subPrompts:
      "What if the fear were played for dark humour rather than straight drama. What if the fear were the thing the audience had never admitted to themselves before this moment.",
    formatTags: ["Film", "Social", "Outdoor", "Experiential"],
    references: [ref("THINK! Embrace Life seatbelt"), ref("Metro Trains Dumb Ways to Die"), ref("Volkswagen Safe Happens")],
  },
  {
    id: "undeniable_fact",
    name: "The Undeniable Fact",
    approach: "Product truth stated as unarguable fact",
    provocation:
      "What is the single most surprising true thing about this brand that proves the proposition without argument. Not a claim. Not an assertion. A fact that lands, cannot be challenged, and permanently changes how the audience sees everything that follows.",
    subPrompts:
      "What if the fact were stated with absolutely no embellishment — just the bare truth and nothing else. What if the fact made the audience feel they had been missing something completely obvious.",
    formatTags: ["Outdoor", "Film", "Social"],
    references: [ref("Rolls-Royce At 60 miles an hour the loudest noise"), ref("Volkswagen Think Small"), ref("Economist white out of red")],
  },
  {
    id: "unexpected_endorsement",
    name: "The Unexpected Endorsement",
    approach: "Testimony from the most surprising source",
    provocation:
      "Who or what is the last entity anyone would expect to endorse this brand. And why does that unexpected endorsement prove the proposition more powerfully than any obvious spokesperson could.",
    subPrompts:
      "What if the testimony came from the brand's biggest critic. What if the endorsement came from an inanimate object, an animal, or a historical figure who could not possibly have planned it.",
    formatTags: ["Film", "Social", "Print"],
    references: [ref("Burger King Moldy Whopper"), ref("Newcastle Brown Ale If We Made It"), ref("Domino's Pizza Turnaround")],
  },
  {
    id: "time_machine",
    name: "The Time Machine",
    approach: "Nostalgia · Return to better times",
    provocation:
      "What cultural moment — music, fashion, film, lifestyle, a specific year — does this brand have the right to inhabit. Can the brand take people back to a more loved point in time and make that return feel like coming home.",
    subPrompts:
      "What if time travel were literally possible in the world of this ad. What if the nostalgia were specific to a generation the brand has never spoken to before.",
    formatTags: ["Film", "Social", "Audio"],
    references: [ref("Hovis Boy on the Bike"), ref("Adidas Originals Represent")],
  },
  {
    id: "rare_thing",
    name: "The Rare Thing",
    approach: "Scarcity · Desirability · The thing people cannot have",
    provocation:
      "Make the brand precious. Give it rarity. What if getting it required something. What does genuine desirability do to how the audience perceives the proposition and why does scarcity make the truth more true.",
    subPrompts:
      "What if access to the brand were deliberately restricted and the restriction were the campaign. What if the brand were available only to those who truly deserved it.",
    formatTags: ["Film", "Experiential", "Social", "PR"],
    references: [ref("McDonald's McRib scarcity"), ref("Supreme drop culture"), ref("Guinness Brewers Project")],
  },
  {
    id: "bookmark_moment",
    name: "The Bookmark Moment",
    approach: "Life's significant emotional moments",
    provocation:
      "What specific bookmark moment in life — a wedding, a birth, a graduation, a first kiss, a last conversation — does this proposition speak to most powerfully. Capture the deep emotional connection and show why the brand belongs there.",
    subPrompts:
      "What if the moment were captured documentary-style rather than scripted. What if the brand were invisible in the moment but its absence would have made the moment impossible.",
    formatTags: ["Film", "Long-form", "Social"],
    references: [ref("Google Loretta Super Bowl"), ref("Bouygues Telecom Wonderful Life"), ref("Extra Gum The Story of Sarah and Juan")],
  },
  {
    id: "human_object",
    name: "The Human Object",
    approach: "Inanimate things given human qualities",
    provocation:
      "Give the brand, the product, or an object in the brand's world human qualities. A personality. A point of view. An emotional life. What does that humanised object do when it encounters the specific human truth at the centre of this brief.",
    subPrompts:
      "What if the product itself were the narrator of its own story. What if everyday objects in the brand's world could talk — what would they say about the brand and why would the audience believe them.",
    formatTags: ["Film", "Social", "Long-form"],
    references: [ref("Ikea Lamp"), ref("Coca-Cola Happiness Machine"), ref("Sainsbury's Mog's Christmas Calamity")],
  },
  {
    id: "broken_rule",
    name: "The Broken Rule",
    approach: "Reality subverted · Impossible made logical",
    provocation:
      "What physical, social, cultural, or logical rule would have to be broken for the proposition to be the only possible response. Break that rule. Show the brand as the catalyst for the impossibility and the reason the world is better for it.",
    subPrompts:
      "Allow men to have babies. Give dogs the freedom to fly. Let people breathe underwater. Whatever could not be done — now can be. The brand made it possible.",
    formatTags: ["Film", "Social", "Outdoor"],
    references: [ref("Honda The Cog"), ref("Adidas Impossible is Nothing"), ref("Sony Bravia Paint")],
  },
  {
    id: "solution_first",
    name: "The Solution First",
    approach: "Brand fix amplified · Problem secondary",
    provocation:
      "Do not focus on the consumer problem. Focus entirely on the brand's solution and make the solution so vivid, dramatic, and compelling that the problem is implied rather than stated. Show how — not why.",
    subPrompts:
      "If the glassware is stronger, show how — not why it matters. If the engine is more powerful, demonstrate the power rather than explain the benefit. The solution is the entire idea.",
    formatTags: ["Film", "Social", "Outdoor"],
    references: [ref("Apple Shot on iPhone"), ref("Dyson engineering demonstration"), ref("3M bus shelter bulletproof glass")],
  },
  {
    id: "sensory_world",
    name: "The Sensory World",
    approach: "Five senses as creative territory",
    provocation:
      "Which of the five senses most directly and surprisingly expresses the truth of this proposition. Build the idea entirely in that sensory register and make the audience experience the proposition rather than understand it.",
    subPrompts:
      "Develop an idea that appeals to all five senses simultaneously. Create an audio-only experience that makes the proposition felt without a single image. What does this brand smell like when the proposition is true.",
    formatTags: ["Audio", "Film", "Experiential"],
    references: [ref("Cadbury Flake sensory"), ref("Lynx Peace scent")],
  },
  {
    id: "ignition_point",
    name: "The Ignition Point",
    approach: "Brand as catalyst for cultural movement",
    provocation:
      "At the heart of every movement is an idea whose time has come. What is the idea this brand has the right to ignite. What does the brand do to light the fire and get out of the way.",
    subPrompts:
      "Create a campaign that encourages people to unplug from technology and reclaim something they have lost. What if the movement were joyful rather than serious. What if joining the movement were effortless.",
    formatTags: ["Social", "Film", "PR", "Experiential"],
    references: [ref("Sport England This Girl Can"), ref("Patagonia Don't Buy This Jacket"), ref("ALS Ice Bucket Challenge")],
  },
  {
    id: "naked_truth",
    name: "The Naked Truth",
    approach: "Unmanufactured honesty · Raw and unfiltered",
    provocation:
      "Unmanufacture the message. Expose the truth that advertising usually hides, smooths over, or politely ignores. People recognise reality immediately. Can this brand be the one that names it.",
    subPrompts:
      "Create an idea that challenges a social norm the category has been protecting. What if the ad showed the product in the context it is actually used rather than the idealised context usually shown.",
    formatTags: ["Film", "Social", "Long-form"],
    references: [ref("Bodyform Blood Normal"), ref("Burger King Moldy Whopper"), ref("Dove Real Beauty")],
  },
  {
    id: "better_world",
    name: "The Better World",
    approach: "Social conscience · Brand as change agent",
    provocation:
      "Does this brand have a stand to make. Is there an injustice it can credibly serve to rectify. A prejudice it can stop. A behaviour it can change. Use the negative in society for the positive of the brand — and do it in a way that invites participation rather than lectures.",
    subPrompts:
      "Create an idea that challenges social norms and stereotypes the category has never questioned. Develop a campaign that promotes sustainability without using sustainability language.",
    formatTags: ["Film", "Social", "PR", "Experiential"],
    references: [ref("Always Like A Girl"), ref("Volvo E.V.A. safety data"), ref("Iceland Rang-tan palm oil")],
  },
  {
    id: "misdirection",
    name: "The Misdirection",
    approach: "Plot twist · Audience led then surprised",
    provocation:
      "Use misdirection as a tool to make the point. Lead the audience down the obvious path. Present the conclusion they expect. Then pull it away and replace it with something so much more true that the surprise proves the proposition better than any direct statement could.",
    subPrompts:
      "Design an idea that plays with perspective and optical illusion. What if the entire premise of the ad turned out to be the opposite of what it appeared to be from the first frame.",
    formatTags: ["Film", "Social", "Digital"],
    references: [ref("Guinness Wheelchair Basketball"), ref("Honda The Other Side")],
  },
  {
    id: "shock_of_new",
    name: "The Shock of the New",
    approach: "Provocation · Rebellion · Creative defiance",
    provocation:
      "Present the audience with something they did not expect and were not ready for. Create something they want to ignore but cannot. Be controversial. Be rebellious. Be defiant. But ensure every element of that defiance is earned by the proposition and traceable to the brand's specific truth.",
    subPrompts:
      "What if the provocation were so unexpected that the audience's first reaction were discomfort followed immediately by recognition. What if the ad challenged something the industry has been afraid to say for years.",
    formatTags: ["Film", "Social", "Outdoor", "PR"],
    references: [ref("Benetton Unhate"), ref("Diesel Be Stupid"), ref("Nike Dream Crazy")],
  },
  {
    id: "relief",
    name: "The Relief",
    approach: "Brand as escape from chaos and pressure",
    provocation:
      "In a world of chaos, noise, and instability, use the brand to take people somewhere genuinely, specifically, immediately better. Make the brand the emotional catalyst that moves people from a negative present state into a positive one — and make that movement feel earned rather than manufactured.",
    subPrompts:
      "What if the relief arrived at precisely the moment when no one thought it was possible. What if the escape were absurd rather than sentimental and the absurdity made it more true.",
    formatTags: ["Film", "Social", "Audio", "Experiential"],
    references: [ref("Coca-Cola Hilltop"), ref("Center Parcs Bear"), ref("Guinness Good Things Come to Those Who Wait")],
  },
  {
    id: "hidden_world",
    name: "The Hidden World",
    approach: "Behind the scenes · Secrets revealed",
    provocation:
      "People are naturally inquisitive. They love to know what others do not. What magical, unexpected, or surprising detail about this brand is hidden from public view. What goes on when no one is watching and why does that discovery prove the proposition.",
    subPrompts:
      "What if the behind-the-scenes revelation were uncomfortable rather than reassuring. What if it revealed something the brand had been modest about rather than something it was hiding from anyone.",
    formatTags: ["Film", "Long-form", "Social"],
    references: [ref("McDonald's Our Food Your Questions"), ref("Domino's Pizza Turnaround"), ref("Patagonia Worn Wear")],
  },
  {
    id: "open_question",
    name: "The Open Question",
    approach: "What if · Unexplored possibility as territory",
    provocation:
      "Explore untrodden territory by asking what if. Propose a new future of some kind. What if the product were tiny. What if it were only available on Mars. A million possibilities — but the idea must be grounded in the specific proposition and traceable to the brand's truth.",
    subPrompts:
      "Imagine a future where technology has advanced significantly — what role does the brand play that it cannot play today. Design an idea that seamlessly blends two unrelated things and makes the combination feel inevitable rather than arbitrary.",
    formatTags: ["Film", "Social", "Long-form", "Experiential"],
    references: [ref("IBM Smarter Planet"), ref("Volvo Life Paint"), ref("Nike House of Innovation")],
  },
];

export const LENS_COUNT = STIMULUS_LENSES.length; // 37

export function getLens(id: string): StimulusLens | undefined {
  return STIMULUS_LENSES.find((l) => l.id === id);
}
