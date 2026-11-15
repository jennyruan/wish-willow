import { internalMutation } from "./_generated/server";

const SF_SPOTS = [
  {
    title: "November Project stair workout",
    place: "Lyon Street Steps",
    when: "Wednesdays, 6:30 AM",
    category: "Run club",
    neighborhood: "Pacific Heights",
    zip: "94115",
  },
  {
    title: "Saturday long run to the Golden Gate Bridge",
    place: "Marina Green",
    when: "Saturdays, 8:00 AM",
    category: "Run club",
    neighborhood: "Marina",
    zip: "94123",
  },
  {
    title: "Cocktails at Trick Dog",
    place: "3010 20th St",
    when: "Thursday, 8:00 PM",
    category: "Bar",
    neighborhood: "Mission",
    zip: "94110",
  },
  {
    title: "Bouldering at Mission Cliffs",
    place: "2295 Harrison St",
    when: "Weeknights, 6:00 PM",
    category: "Climbing gym",
    neighborhood: "Mission",
    zip: "94110",
  },
  {
    title: "Climb night at Dogpatch Boulders",
    place: "2573 3rd St",
    when: "Tuesday, 7:00 PM",
    category: "Climbing gym",
    neighborhood: "Dogpatch",
    zip: "94107",
  },
  {
    title: "Lands End coastal trail hike",
    place: "Lands End Lookout, 680 Point Lobos Ave",
    when: "Sunday, 10:00 AM",
    category: "Outdoor hike",
    neighborhood: "Outer Richmond",
    zip: "94121",
  },
  {
    title: "Lindy in the Park swing dancing",
    place: "JFK Promenade near the Conservatory of Flowers",
    when: "Sundays, 11:00 AM",
    category: "Dance & music",
    neighborhood: "Golden Gate Park",
    zip: "94118",
  },
  {
    title: "Live jazz at SFJAZZ Center",
    place: "201 Franklin St",
    when: "Friday, 7:30 PM",
    category: "Dance & music",
    neighborhood: "Hayes Valley",
    zip: "94102",
  },
  {
    title: "Ferry Plaza Farmers Market",
    place: "Ferry Building, 1 Ferry Building",
    when: "Saturdays, 8:00 AM – 2:00 PM",
    category: "Farmers market",
    neighborhood: "Embarcadero",
    zip: "94111",
  },
  {
    title: "Alemany Farmers Market",
    place: "100 Alemany Blvd",
    when: "Saturdays, 6:00 AM – 3:00 PM",
    category: "Farmers market",
    neighborhood: "Bernal Heights",
    zip: "94110",
  },
];

export const seedSuggestions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("suggestions").first();
    if (existing) return { inserted: 0 };
    for (const spot of SF_SPOTS) {
      await ctx.db.insert("suggestions", { ...spot, status: "pending" });
    }
    return { inserted: SF_SPOTS.length };
  },
});
