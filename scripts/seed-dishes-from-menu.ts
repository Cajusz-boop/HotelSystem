/**
 * Seed słownika dań z docs/MENU-IMPREZY-KARCZMA-LABEDZ.md
 * Uruchom: npx tsx scripts/seed-dishes-from-menu.ts
 */
import "dotenv/config";
import { prisma } from "../lib/db";

const DISHES: { name: string; category?: string }[] = [
  // Zupy
  { name: "Rosół z makaronem", category: "Zupa" },
  { name: "Rosół z kury z makaronem", category: "Zupa" },
  { name: "Rosół drobiowo-wołowy z kluseczkami", category: "Zupa" },
  { name: "Rosół z kluskami i lubczykiem", category: "Zupa" },
  { name: "Barszcz czerwony", category: "Zupa" },
  { name: "Barszcz z pierogami", category: "Zupa" },
  { name: "Barszcz z krokietem", category: "Zupa" },
  { name: "Zupa pomidorowa z makaronem", category: "Zupa" },
  { name: "Krem z białych warzyw z pesto rukolowym", category: "Zupa" },
  { name: "Zupa krem z cukinii z grzankami", category: "Zupa" },
  { name: "Krem z cukinii z chipsem z szynki parmeńskiej", category: "Zupa" },
  // Dania mięsne
  { name: "Schabowy", category: "Danie główne" },
  { name: "Kotlet schabowy", category: "Danie główne" },
  { name: "Schabowy wieprzowy", category: "Danie główne" },
  { name: "Schabowy drobiowy", category: "Danie główne" },
  { name: "De volaille", category: "Danie główne" },
  { name: "De volaille z serem", category: "Danie główne" },
  { name: "Kotlet de volaille z serem", category: "Danie główne" },
  { name: "Udko z kurczaka", category: "Danie główne" },
  { name: "Rumiane udko z kurczaka", category: "Danie główne" },
  { name: "Udko z kurczaka, karkówka w sosie, schabowy, de volaille", category: "Danie główne" },
  { name: "Udko z serem camembert", category: "Danie główne" },
  { name: "Karkówka w sosie", category: "Danie główne" },
  { name: "Karkówka w sosie podana z kaszą pęczak", category: "Danie główne" },
  { name: "Kieszonka wieprzowa faszerowana pieczarkami", category: "Danie główne" },
  { name: "Pierś otulona boczkiem podana na cukinii z marchewką", category: "Danie główne" },
  { name: "Dorsz w sosie koperkowym", category: "Danie główne" },
  { name: "Eskalop w sosie porowym", category: "Danie główne" },
  { name: "Eskalop drobiowy w sosie porowym", category: "Danie główne" },
  { name: "Eskalop", category: "Danie główne" },
  { name: "Zraz w sosie własnym", category: "Danie główne" },
  { name: "Ryba w sosie porowym", category: "Danie główne" },
  { name: "Ryba w sosie śmietanowym", category: "Danie główne" },
  { name: "Nuggetsy z frytkami", category: "Danie główne" },
  { name: "Nuggetsy z frytkami i sosem czosnkowym", category: "Danie główne" },
  { name: "Polędwiczki wieprzowe w sosie pieprzowym z chrupiącą bagietką", category: "Danie główne" },
  { name: "Polędwiczki wieprzowe podane na puree chrzanowo-pietruszkowym muśnięte sosem z zielonego pieprzu", category: "Danie główne" },
  { name: "Gołąbki mięsne", category: "Danie główne" },
  { name: "Gołąbki w sosie pomidorowym", category: "Danie główne" },
  { name: "Żeberka na słodko z ziemniakami opiekanymi", category: "Danie główne" },
  { name: "Żeberka w kapuście kiszonej", category: "Danie główne" },
  { name: "Medaliony drobiowe z frytkami", category: "Danie główne" },
  { name: "Strogonow wieprzowy z plackami ziemniaczanymi", category: "Danie główne" },
  { name: "Rulon drobiowy z porem i serem gorgonzola", category: "Danie główne" },
  { name: "Rulon drobiowy nadziewany szpinakiem serwowany z pieczonym batatem w aromatycznych ziołach", category: "Danie główne" },
  { name: "Pierś z ananasem", category: "Danie główne" },
  { name: "Udko kacze", category: "Danie główne" },
  { name: "Fileciki drobiowe panierowane z frytkami", category: "Danie główne" },
  { name: "Zraz z kaszą pęczak", category: "Danie główne" },
  { name: "Kieszonka wieprzowa", category: "Danie główne" },
  { name: "Kotlet mielony z farszem pieczarkowym", category: "Danie główne" },
  { name: "Karkówka w sosie własnym", category: "Danie główne" },
  { name: "Sandacz w sosie koperkowym", category: "Danie główne" },
  { name: "Pierś z kurczaka ze szpinakiem", category: "Danie główne" },
  { name: "Gulasz wieprzowy", category: "Danie główne" },
  { name: "Pizza — 3 rodzaje", category: "Danie główne" },
  { name: "Mini burgery", category: "Danie główne" },
  { name: "Kurczak z ryżem w sosie słodko-kwaśnym", category: "Danie główne" },
  { name: "Cukinia faszerowana mięsem mielonym z sosem czosnkowym", category: "Danie główne" },
  { name: "Szaszłyki z mięsa mielonego otulone boczkiem z sosem czosnkowym", category: "Danie główne" },
  // Dodatki
  { name: "Ziemniaki", category: "Dodatki" },
  { name: "Ziemniaki z wody", category: "Dodatki" },
  { name: "Ziemniaki z koperkiem", category: "Dodatki" },
  { name: "Ziemniaki zapiekane", category: "Dodatki" },
  { name: "Ziemniaki z wody na pół z frytkami", category: "Dodatki" },
  { name: "Kasza pęczak", category: "Dodatki" },
  { name: "Kulki ziemniaczane", category: "Dodatki" },
  // Surówki
  { name: "Surówka z białej kapusty", category: "Surówki" },
  { name: "Surówka z selera z prażonym słonecznikiem", category: "Surówki" },
  { name: "Surówka z kapusty pekińskiej", category: "Surówki" },
  { name: "Surówka z marchewki", category: "Surówki" },
  { name: "Surówka Colesław", category: "Surówki" },
  { name: "Surówka z kiszonej kapusty", category: "Surówki" },
  { name: "Buraczki", category: "Surówki" },
  { name: "Buraczki zasmażane na ciepło", category: "Surówki" },
  { name: "Bukiet warzyw gotowanych", category: "Surówki" },
  { name: "Bukiet warzyw gotowanych z masłem i bułką tartą", category: "Surówki" },
  { name: "Mizeria", category: "Surówki" },
  { name: "Fasolka szparagowa z bułką tartą", category: "Surówki" },
  { name: "Fasolka z masłem i bułką tartą", category: "Surówki" },
  { name: "Fasolka z masełkiem", category: "Surówki" },
  { name: "Groszek z marchewką", category: "Surówki" },
  { name: "Marchewka z ananasem", category: "Surówki" },
  // Przekąski zimne
  { name: "Rolada szpinakowa z łososiem", category: "Przekąski" },
  { name: "Mini tortilla warzywna z szynką", category: "Przekąski" },
  { name: "Mini tortilla z szynką", category: "Przekąski" },
  { name: "Mini tortilla z szynką i serem", category: "Przekąski" },
  { name: "Mini tortilla z łososiem", category: "Przekąski" },
  { name: "Rolady (dwa rodzaje)", category: "Przekąski" },
  { name: "Schab ze śliwką", category: "Przekąski" },
  { name: "Ryba po japońsku", category: "Przekąski" },
  { name: "Klopsiki w zalewie octowej", category: "Przekąski" },
  { name: "Sałatka grecka", category: "Przekąski" },
  { name: "Sałatka jarzynowa", category: "Przekąski" },
  { name: "Sałatka jarzynowa na babeczkach", category: "Przekąski" },
  { name: "Sałatka w koszyczkach", category: "Przekąski" },
  { name: "Sałatka w koszyczku", category: "Przekąski" },
  { name: "Śledź z burakiem", category: "Przekąski" },
  { name: "Sałatka śledziowa", category: "Przekąski" },
  { name: "Ryba po grecku", category: "Przekąski" },
  { name: "Tymbaliki z pstrąga", category: "Przekąski" },
  { name: "Tymbaliki z łososiem", category: "Przekąski" },
  { name: "Tatarki wołowe na krążkach party", category: "Przekąski" },
  { name: "Tatar z łososia", category: "Przekąski" },
  { name: "Sałatka Cezar", category: "Przekąski" },
  { name: "Sałatka z wędzonym kurczakiem", category: "Przekąski" },
  { name: "Sałatka z ryżem i grillowanym kurczakiem", category: "Przekąski" },
  { name: "Sałatka z kolorowym makaronem i kurczakiem", category: "Przekąski" },
  { name: "Carpaccio z buraka", category: "Przekąski" },
  { name: "Krążki tatara wołowego z cebulą i ogórkiem", category: "Przekąski" },
  { name: "Sałatka Gyros", category: "Przekąski" },
  { name: "Deska naszych przysmaków", category: "Przekąski" },
  { name: "Tatarki (z pstrąga, wołowe, z łososia)", category: "Przekąski" },
  { name: "Śledzik w śmietanie z jabłkiem", category: "Przekąski" },
  { name: "Ryba w sosie pomidorowym", category: "Przekąski" },
  { name: "Kąski pstrąga w galarecie", category: "Przekąski" },
  { name: "Pasztet wiejski z sosem żurawinowo-chrzanowym", category: "Przekąski" },
  { name: "Sałatka w ambuszkach (3 rodzaje)", category: "Przekąski" },
  { name: "Sałatka z grillowanym kurczakiem", category: "Przekąski" },
  { name: "Bagietka z pastą jajeczną i paprykową", category: "Przekąski" },
  { name: "Kolorowe koreczki", category: "Przekąski" },
  { name: "Sałatki w kubeczkach — 3 rodzaje", category: "Przekąski" },
  { name: "Mix koreczków", category: "Przekąski" },
  { name: "Półmisek frykasów", category: "Przekąski" },
  // Pierogi
  { name: "Pierogi z kapustą i grzybami oraz ruskie", category: "Danie główne" },
  { name: "Mix pierogów", category: "Danie główne" },
  { name: "Mix pierogów z okrasą", category: "Danie główne" },
  { name: "Pierogi z kaczką z masełkiem szałwiowym", category: "Danie główne" },
  // Desery i ciasta
  { name: "Sernik", category: "Deser" },
  { name: "Szarlotka", category: "Deser" },
  { name: "Krówka", category: "Deser" },
  { name: "Sernik złota rosa", category: "Deser" },
  { name: "3-bit", category: "Deser" },
  { name: "Pychotka", category: "Deser" },
  { name: "Słonecznikowiec", category: "Deser" },
  { name: "Makowiec", category: "Deser" },
  { name: "Sernik z wiśnią", category: "Deser" },
  { name: "Panna Cotta", category: "Deser" },
  { name: "Mango", category: "Deser" },
  { name: "Eklery", category: "Deser" },
  { name: "Donaty", category: "Deser" },
  { name: "Deserki oreo", category: "Deser" },
  { name: "Sernik z mango", category: "Deser" },
  { name: "Sernik z karmelem", category: "Deser" },
  { name: "Malinowa chmurka", category: "Deser" },
  { name: "Mini eklery", category: "Deser" },
  { name: "Deser oreo", category: "Deser" },
  { name: "Deser z karmelem", category: "Deser" },
  { name: "Deser leśny mech", category: "Deser" },
  { name: "Tarta lemon curd", category: "Deser" },
  { name: "Cake pops", category: "Deser" },
  { name: "Rafaello", category: "Deser" },
  { name: "Czarny Las", category: "Deser" },
  { name: "Góra lodowa", category: "Deser" },
  { name: "Królowa śniegu", category: "Deser" },
  { name: "Łabędzi puch", category: "Deser" },
  // Napoje
  { name: "Sok jabłkowy", category: "Napoje" },
  { name: "Sok pomarańczowy", category: "Napoje" },
  { name: "Kawa i herbata na szwedzkim stole", category: "Napoje" },
  { name: "Kawa i herbata", category: "Napoje" },
  { name: "Kawa i herbata na szwedzkim stole — szwedzki stół", category: "Napoje" },
  { name: "Kawa, herbata podawana bez ograniczeń", category: "Napoje" },
  { name: "Coca-Cola, Fanta, Sprite, woda niegazowana, sok jabłkowy, sok pomarańczowy", category: "Napoje" },
  { name: "Nielimitowany pakiet napoi", category: "Napoje" },
  { name: "Pieczywo", category: "Inne" },
  { name: "Chleb, owoce", category: "Inne" },
];

async function main() {
  console.log("Seedowanie słownika dań z MENU-IMPREZY-KARCZMA-LABEDZ.md...");
  let created = 0;
  let skipped = 0;
  for (const { name, category } of DISHES) {
    const n = name.trim();
    if (!n) continue;
    const existing = await prisma.dish.findFirst({ where: { name: n } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.dish.create({
      data: {
        name: n,
        defaultPrice: 0,
        vatRate: 0.08,
        category: category || null,
        isActive: true,
      },
    });
    created++;
    console.log("  +", n);
  }
  console.log(`\nZakończono: ${created} dodanych, ${skipped} już istniało.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
