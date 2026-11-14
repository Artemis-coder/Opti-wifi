import fs from "node:fs";
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { LEGAL_META, formatLegalDate, legalBlocks, type LegalDoc, type LegalSlug } from "@/lib/legal";

// Pas de césure automatique (« Opti-Space »)
Font.registerHyphenationCallback((word) => [word]);

/** Espaces insécables du français : jamais de « : » ou « ; » seul en début de ligne. */
const fr = (t: string) =>
  t.replace(/ ([:;!?»])/g, "\u00a0$1").replace(/« /g, "«\u00a0").replace(/(\d) (?=\d)/g, "$1\u00a0");

const GREEN = "#2b6b45";
const INK = "#0e1f15";
const SOFT = "#52665a";

const s = StyleSheet.create({
  page: { paddingTop: 42, paddingBottom: 56, paddingHorizontal: 48, fontFamily: "Helvetica", fontSize: 10.5, color: SOFT, lineHeight: 1.5 },
  brand: { flexDirection: "row", alignItems: "center", marginBottom: 26 },
  logo: { width: 26, height: 26, borderRadius: 6, marginRight: 8 },
  brandText: { fontFamily: "Helvetica-Bold", fontSize: 14, color: INK },
  kicker: { fontFamily: "Helvetica-Bold", fontSize: 9, color: GREEN, letterSpacing: 1.5 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 22, color: INK, marginTop: 4, lineHeight: 1.25 },
  meta: { fontSize: 9, marginTop: 8 },
  intro: { fontSize: 11.5, marginTop: 14, marginBottom: 8 },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 13, color: INK, marginTop: 16, marginBottom: 6 },
  p: { marginBottom: 6 },
  li: { flexDirection: "row", marginBottom: 3, paddingLeft: 4 },
  bullet: { width: 12, color: GREEN },
  liText: { flex: 1 },
  footer: { position: "absolute", bottom: 26, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: SOFT },
});

function LegalPdf({ slug, doc }: { slug: LegalSlug; doc: LegalDoc }) {
  const meta = LEGAL_META[slug];
  const logo = fs.readFileSync(path.join(process.cwd(), "public", "logo.jpg"));
  return (
    <Document title={`OptiSpace — ${meta.title}`} author="Optimus Group" language="fr">
      <Page size="A4" style={s.page}>
        <View style={s.brand}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf, sans attribut alt */}
          <Image src={logo} style={s.logo} />
          <Text style={s.brandText}>OptiSpace</Text>
        </View>
        <Text style={s.kicker}>{meta.short}</Text>
        <Text style={s.title}>{meta.title}</Text>
        <Text style={s.meta}>
          Version {doc.version} · Mise à jour le {formatLegalDate(doc.updated_at)}
        </Text>
        <Text style={s.intro}>{fr(doc.intro)}</Text>

        {doc.sections.map((sec, i) => (
          <View key={i}>
            <Text style={s.h2} minPresenceAhead={40}>
              {fr(sec.title)}
            </Text>
            {legalBlocks(sec.body).map((b, j) =>
              b.type === "p" ? (
                <Text key={j} style={s.p}>
                  {fr(b.text)}
                </Text>
              ) : (
                <View key={j} style={s.p}>
                  {b.items.map((item, k) => (
                    <View key={k} style={s.li} wrap={false}>
                      <Text style={s.bullet}>•</Text>
                      <Text style={s.liText}>{fr(item)}</Text>
                    </View>
                  ))}
                </View>
              ),
            )}
          </View>
        ))}

        <View style={s.footer} fixed>
          <Text>OptiSpace — {meta.title} (version {doc.version})</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export function renderLegalPdf(slug: LegalSlug, doc: LegalDoc): Promise<Buffer> {
  return renderToBuffer(<LegalPdf slug={slug} doc={doc} />);
}
