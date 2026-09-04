import type { HolidayProvider, PublicHoliday } from "../types";

/** A few fixed-date holidays for the demo countries so offline plans still warn. */
const fixed: Record<string, { md: string; name: string; localName: string }[]> = {
  PT: [
    { md: "01-01", name: "New Year's Day", localName: "Ano Novo" },
    { md: "04-25", name: "Freedom Day", localName: "Dia da Liberdade" },
    { md: "05-01", name: "Labour Day", localName: "Dia do Trabalhador" },
    { md: "06-10", name: "Portugal Day", localName: "Dia de Portugal" },
    { md: "08-15", name: "Assumption Day", localName: "Assunção de Nossa Senhora" },
    { md: "10-05", name: "Republic Day", localName: "Implantação da República" },
    { md: "11-01", name: "All Saints' Day", localName: "Dia de Todos os Santos" },
    { md: "12-01", name: "Restoration of Independence", localName: "Restauração da Independência" },
    { md: "12-08", name: "Immaculate Conception", localName: "Imaculada Conceição" },
    { md: "12-25", name: "Christmas Day", localName: "Natal" },
  ],
  IT: [
    { md: "01-01", name: "New Year's Day", localName: "Capodanno" },
    { md: "01-06", name: "Epiphany", localName: "Epifania" },
    { md: "04-25", name: "Liberation Day", localName: "Festa della Liberazione" },
    { md: "05-01", name: "Labour Day", localName: "Festa del Lavoro" },
    { md: "06-02", name: "Republic Day", localName: "Festa della Repubblica" },
    { md: "08-15", name: "Assumption Day", localName: "Ferragosto" },
    { md: "11-01", name: "All Saints' Day", localName: "Ognissanti" },
    { md: "12-08", name: "Immaculate Conception", localName: "Immacolata Concezione" },
    { md: "12-25", name: "Christmas Day", localName: "Natale" },
    { md: "12-26", name: "St. Stephen's Day", localName: "Santo Stefano" },
  ],
  JP: [
    { md: "01-01", name: "New Year's Day", localName: "元日" },
    { md: "02-11", name: "National Foundation Day", localName: "建国記念の日" },
    { md: "04-29", name: "Shōwa Day", localName: "昭和の日" },
    { md: "05-03", name: "Constitution Memorial Day", localName: "憲法記念日" },
    { md: "05-04", name: "Greenery Day", localName: "みどりの日" },
    { md: "05-05", name: "Children's Day", localName: "こどもの日" },
    { md: "08-11", name: "Mountain Day", localName: "山の日" },
    { md: "11-03", name: "Culture Day", localName: "文化の日" },
    { md: "11-23", name: "Labour Thanksgiving Day", localName: "勤労感謝の日" },
  ],
};

export const mockHolidays: HolidayProvider = {
  name: "mock-holidays",
  async holidays(countryCode: string, year: number): Promise<PublicHoliday[]> {
    return (fixed[countryCode.toUpperCase()] ?? []).map((h) => ({
      date: `${year}-${h.md}`,
      name: h.name,
      localName: h.localName,
      countryCode: countryCode.toUpperCase(),
    }));
  },
};
