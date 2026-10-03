import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RapportData, Recu, Sortie, StockItem } from '../types';
import { formatDateTime, formatFCFA, formatNumber } from '../utils/formatters';

/**
 * Adds a clean archival footer with page numbers ("Page X / Y") to all pages of a jsPDF document
 */
function addPageFooters(doc: jsPDF, docLabel: string) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${docLabel} — Document généré pour impression et archivage externe`,
      14,
      pageHeight - 7
    );
    doc.text(`Page ${i} / ${pageCount}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }
}

export const pdfService = {
  /**
   * Exports a single sales or purchase receipt to a clean, professional PDF
   */
  exportReceiptToPDF(recu: Recu) {
    const doc = new jsPDF({ unit: 'mm', format: 'a5' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header bar
    doc.setFillColor(4, 120, 87); // #047857
    doc.rect(0, 0, pageWidth, 20, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    const typeTitle =
      recu.type_operation === 'ENTREE' ? "REÇU D'APPROVISIONNEMENT" : 'REÇU DE VENTE';
    doc.text(typeTitle, pageWidth / 2, 13, { align: 'center' });

    // Receipt metadata
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`N° Reçu : ${recu.numero_recu}`, 14, 32);
    doc.text(`Date : ${formatDateTime(recu.date_recu)}`, 14, 38);

    const partnerLabel = recu.type_operation === 'ENTREE' ? 'Fournisseur' : 'Client';
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 44, pageWidth - 28, 18, 2, 2, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(`${partnerLabel} : ${recu.partenaire_nom || '-'}`, 18, 51);
    doc.setFont('helvetica', 'normal');
    doc.text(`Contact : ${recu.partenaire_contact || '-'}`, 18, 57);

    // Line items table
    autoTable(doc, {
      startY: 68,
      margin: { left: 14, right: 14 },
      head: [['Produit', 'Catégorie', 'Qté', 'Prix Unitaire', 'Prix Total']],
      body: [
        [
          recu.produit_nom,
          recu.categorie_nom || '-',
          `${formatNumber(recu.quantite)} ${recu.unite || ''}`,
          formatFCFA(recu.prix_unitaire),
          formatFCFA(recu.prix_total),
        ],
      ],
      headStyles: {
        fillColor: [4, 120, 87],
        textColor: 255,
        fontSize: 8.5,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [15, 23, 42],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 100;

    // Total box
    doc.setFillColor(236, 253, 245); // Light green
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(14, finalY + 8, pageWidth - 28, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(6, 95, 70);
    doc.text('TOTAL GÉNÉRAL :', 18, finalY + 18);
    doc.setFontSize(12);
    doc.text(formatFCFA(recu.total_general), pageWidth - 18, finalY + 18, { align: 'right' });

    doc.save(`${recu.numero_recu}.pdf`);
  },

  /**
   * Exports Sales list (Rapport de Ventes) to a clean, printable & archivable A4 PDF
   */
  exportSalesToPDF(sorties: Sortie[], subtitle?: string) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(4, 120, 87);
    doc.rect(0, 0, pageWidth, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('RAPPORT DES VENTES', 14, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(subtitle || `Total : ${sorties.length} vente(s) enregistrée(s)`, 14, 18);
    doc.text(`Édité le ${formatDateTime(new Date().toISOString())}`, pageWidth - 14, 14, {
      align: 'right',
    });

    const totalMontant = sorties.reduce((acc, s) => acc + Number(s.prix_total || 0), 0);
    const totalQuantite = sorties.reduce((acc, s) => acc + Number(s.quantite || 0), 0);

    // Summary KPI Box
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(14, 28, pageWidth - 28, 12, 2, 2, 'FD');
    doc.setTextColor(6, 95, 70);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(
      `Nombre de ventes : ${formatNumber(sorties.length)}   |   Quantité totale vendue : ${formatNumber(
        totalQuantite
      )}   |   Chiffre d'affaires total : ${formatFCFA(totalMontant)}`,
      18,
      35.5
    );

    autoTable(doc, {
      startY: 44,
      margin: { bottom: 18 },
      head: [
        [
          'N° Reçu',
          'Date & Heure',
          'Produit',
          'Catégorie',
          'Client',
          'Contact',
          'Quantité',
          'Prix Unitaire',
          'Montant Total',
        ],
      ],
      body: sorties.map((v) => [
        v.numero_recu,
        formatDateTime(v.date_vente),
        v.produit_nom || `Produit #${v.produit_id}`,
        v.categorie_nom || '-',
        v.client_nom || '-',
        v.client_contact || '-',
        `${formatNumber(v.quantite)} ${v.unite || ''}`,
        formatFCFA(v.prix_unitaire),
        formatFCFA(v.prix_total),
      ]),
      foot: [
        [
          'TOTAL GÉNÉRAL',
          '',
          '',
          '',
          '',
          `${formatNumber(sorties.length)} vente(s)`,
          `${formatNumber(totalQuantite)} unités`,
          '',
          formatFCFA(totalMontant),
        ],
      ],
      headStyles: { fillColor: [4, 120, 87], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
      footStyles: {
        fillColor: [236, 253, 245],
        textColor: [6, 95, 70],
        fontSize: 8.5,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    addPageFooters(doc, 'Rapport des Ventes');
    doc.save(`RAPPORT_VENTES_${new Date().toISOString().slice(0, 10)}.pdf`);
  },

  /**
   * Exports Stock Inventory (Rapport de Stock) to a clean, printable & archivable A4 PDF
   */
  exportStockToPDF(stock: StockItem[]) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(4, 120, 87);
    doc.rect(0, 0, pageWidth, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('RAPPORT D’ÉTAT COMPLET DU STOCK', 14, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Inventaire de ${stock.length} produit(s)`, 14, 18);
    doc.text(`Édité le ${formatDateTime(new Date().toISOString())}`, pageWidth - 14, 14, {
      align: 'right',
    });

    const totalEntrees = stock.reduce((acc, s) => acc + Number(s.total_entrees || 0), 0);
    const totalSorties = stock.reduce((acc, s) => acc + Number(s.total_sorties || 0), 0);
    const totalDispo = stock.reduce((acc, s) => acc + Number(s.quantite_disponible || 0), 0);
    const nbEnStock = stock.filter((s) => s.statut === 'EN STOCK').length;
    const nbFaible = stock.filter((s) => s.statut === 'STOCK FAIBLE').length;
    const nbRupture = stock.filter((s) => s.statut === 'RUPTURE').length;

    // Summary KPI Box
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(14, 28, pageWidth - 28, 12, 2, 2, 'FD');
    doc.setTextColor(6, 95, 70);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(
      `Produits : ${formatNumber(stock.length)}   |   Reste disponible : ${formatNumber(
        totalDispo
      )} unités   |   En stock : ${nbEnStock}   |   Stock faible : ${nbFaible}   |   Rupture : ${nbRupture}`,
      18,
      35.5
    );

    autoTable(doc, {
      startY: 44,
      margin: { bottom: 18 },
      head: [
        [
          'Produit',
          'Catégorie',
          'Unité',
          'Total Entrées',
          'Total Sorties',
          'Stock Disponible (Reste)',
          "Seuil d'alerte",
          'Statut',
          'Dernière MAJ',
        ],
      ],
      body: stock.map((s) => [
        s.produit_nom,
        s.categorie_nom || '-',
        s.unite,
        `+${formatNumber(s.total_entrees)}`,
        `-${formatNumber(s.total_sorties)}`,
        `${formatNumber(s.quantite_disponible)} ${s.unite}`,
        formatNumber(s.seuil_alerte),
        s.statut,
        formatDateTime(s.derniere_mise_a_jour),
      ]),
      foot: [
        [
          'TOTAL INVENTAIRE',
          `${formatNumber(stock.length)} article(s)`,
          '',
          `+${formatNumber(totalEntrees)}`,
          `-${formatNumber(totalSorties)}`,
          `${formatNumber(totalDispo)} unités`,
          '',
          '',
          '',
        ],
      ],
      headStyles: { fillColor: [4, 120, 87], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
      footStyles: {
        fillColor: [236, 253, 245],
        textColor: [6, 95, 70],
        fontSize: 8.5,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    addPageFooters(doc, 'Rapport du Stock');
    doc.save(`RAPPORT_STOCK_${new Date().toISOString().slice(0, 10)}.pdf`);
  },

  /**
   * Exports a combined Sales & Stock Report (Bilan Complet Ventes + Stocks) in a single PDF for printing and archiving
   */
  exportCombinedSalesAndStockToPDF(report: RapportData) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(4, 120, 87);
    doc.rect(0, 0, pageWidth, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('BILAN COMPLET : RAPPORT DES VENTES & ÉTAT DES STOCKS', 14, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Période : du ${report.date_debut} au ${report.date_fin}`, 14, 18);
    doc.text(`Édité le ${formatDateTime(new Date().toISOString())}`, pageWidth - 14, 14, {
      align: 'right',
    });

    // Global Summary Box
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(14, 28, pageWidth - 28, 12, 2, 2, 'FD');
    doc.setTextColor(6, 95, 70);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const summaryLine = `Ventes : ${report.resume.nombre_ventes} (${formatFCFA(
      report.resume.total_ventes
    )})   |   Unités vendues : ${formatNumber(
      report.resume.produits_vendus
    )}   |   Achats : ${report.resume.nombre_achats} (${formatFCFA(
      report.resume.total_achats
    )})   |   Articles en stock : ${formatNumber(report.stock.length)}`;
    doc.text(summaryLine, 18, 35.5);

    // Section 1: Rapport des Ventes
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`1. DÉTAIL DES VENTES DE LA PÉRIODE (${report.ventes.length})`, 14, 47);

    autoTable(doc, {
      startY: 50,
      margin: { bottom: 18 },
      head: [
        [
          'N° Reçu',
          'Date',
          'Produit',
          'Catégorie',
          'Client',
          'Quantité',
          'Prix Unitaire',
          'Montant Total',
        ],
      ],
      body:
        report.ventes.length > 0
          ? report.ventes.map((v) => [
              v.numero_recu,
              formatDateTime(v.date_vente),
              v.produit_nom || '-',
              v.categorie_nom || '-',
              v.client_nom,
              `${formatNumber(v.quantite)} ${v.unite || ''}`,
              formatFCFA(v.prix_unitaire),
              formatFCFA(v.prix_total),
            ])
          : [['-', '-', 'Aucune vente enregistrée sur cette période', '-', '-', '-', '-', '0 FCFA']],
      foot: [
        [
          'TOTAL VENTES',
          '',
          '',
          '',
          `${formatNumber(report.resume.nombre_ventes)} vente(s)`,
          `${formatNumber(report.resume.produits_vendus)} unités`,
          '',
          formatFCFA(report.resume.total_ventes),
        ],
      ],
      headStyles: { fillColor: [4, 120, 87], textColor: 255, fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
      footStyles: {
        fillColor: [236, 253, 245],
        textColor: [6, 95, 70],
        fontSize: 8.5,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const afterSalesY = ((doc as any).lastAutoTable?.finalY || 90) + 12;
    const pageHeight = doc.internal.pageSize.getHeight();

    let stockStartY = afterSalesY;
    if (stockStartY > pageHeight - 55) {
      doc.addPage();
      stockStartY = 20;
    }

    // Section 2: Rapport de l'État des Stocks
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`2. ÉTAT ACTUEL DES STOCKS (${report.stock.length} PRODUITS)`, 14, stockStartY);

    const totalDispo = report.stock.reduce((acc, s) => acc + Number(s.quantite_disponible || 0), 0);
    const totalEntrees = report.stock.reduce((acc, s) => acc + Number(s.total_entrees || 0), 0);
    const totalSorties = report.stock.reduce((acc, s) => acc + Number(s.total_sorties || 0), 0);

    autoTable(doc, {
      startY: stockStartY + 3,
      margin: { bottom: 18 },
      head: [
        [
          'Produit',
          'Catégorie',
          'Total Entrées',
          'Total Sorties',
          'Stock Disponible (Reste)',
          "Seuil d'alerte",
          'Statut',
        ],
      ],
      body:
        report.stock.length > 0
          ? report.stock.map((s) => [
              s.produit_nom,
              s.categorie_nom || '-',
              `+${formatNumber(s.total_entrees)}`,
              `-${formatNumber(s.total_sorties)}`,
              `${formatNumber(s.quantite_disponible)} ${s.unite}`,
              formatNumber(s.seuil_alerte),
              s.statut,
            ])
          : [['Aucun produit en stock', '-', '0', '0', '0', '0', '-']],
      foot: [
        [
          'TOTAL STOCK',
          `${formatNumber(report.stock.length)} produit(s)`,
          `+${formatNumber(totalEntrees)}`,
          `-${formatNumber(totalSorties)}`,
          `${formatNumber(totalDispo)} unités`,
          '',
          '',
        ],
      ],
      headStyles: { fillColor: [4, 120, 87], textColor: 255, fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
      footStyles: {
        fillColor: [236, 253, 245],
        textColor: [6, 95, 70],
        fontSize: 8.5,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    addPageFooters(doc, 'Bilan Ventes & Stocks');
    doc.save(`BILAN_VENTES_ET_STOCKS_${new Date().toISOString().slice(0, 10)}.pdf`);
  },

  /**
   * Exports comprehensive Report to PDF for any tab
   */
  exportReportToPDF(
    report: RapportData,
    activeTab: 'ventes' | 'achats' | 'stock' | 'produits' | 'clients' | 'fournisseurs'
  ) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    const titles: Record<string, string> = {
      ventes: 'RAPPORT DES VENTES',
      achats: 'RAPPORT DES ACHATS (ENTRÉES)',
      stock: 'RAPPORT DE L’ÉTAT DU STOCK',
      produits: 'RAPPORT DES PRODUITS',
      clients: 'RAPPORT DES CLIENTS',
      fournisseurs: 'RAPPORT DES FOURNISSEURS',
    };

    doc.setFillColor(4, 120, 87);
    doc.rect(0, 0, pageWidth, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(titles[activeTab] || 'RAPPORT', 14, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Période : ${report.date_debut} au ${report.date_fin}`, 14, 18);
    doc.text(`Édité le ${formatDateTime(new Date().toISOString())}`, pageWidth - 14, 14, {
      align: 'right',
    });

    // Summary row
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(14, 28, pageWidth - 28, 12, 2, 2, 'FD');
    doc.setTextColor(6, 95, 70);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const summaryLine = `Ventes : ${report.resume.nombre_ventes} (${formatFCFA(
      report.resume.total_ventes
    )})   |   Achats : ${report.resume.nombre_achats} (${formatFCFA(
      report.resume.total_achats
    )})   |   Produits vendus : ${formatNumber(
      report.resume.produits_vendus
    )}   |   Produits achetés : ${formatNumber(report.resume.produits_achetes)}`;
    doc.text(summaryLine, 18, 35.5);

    if (activeTab === 'ventes') {
      autoTable(doc, {
        startY: 44,
        margin: { bottom: 18 },
        head: [
          ['N° Reçu', 'Date', 'Produit', 'Catégorie', 'Client', 'Qté', 'Prix Unitaire', 'Prix Total'],
        ],
        body: report.ventes.map((v) => [
          v.numero_recu,
          formatDateTime(v.date_vente),
          v.produit_nom || '-',
          v.categorie_nom || '-',
          v.client_nom,
          `${formatNumber(v.quantite)} ${v.unite || ''}`,
          formatFCFA(v.prix_unitaire),
          formatFCFA(v.prix_total),
        ]),
        foot: [
          [
            'TOTAL GÉNÉRAL',
            '',
            '',
            '',
            `${formatNumber(report.resume.nombre_ventes)} vente(s)`,
            `${formatNumber(report.resume.produits_vendus)} unités`,
            '',
            formatFCFA(report.resume.total_ventes),
          ],
        ],
        headStyles: { fillColor: [4, 120, 87], textColor: 255, fontSize: 8.5 },
        bodyStyles: { fontSize: 8 },
        footStyles: {
          fillColor: [236, 253, 245],
          textColor: [6, 95, 70],
          fontSize: 8.5,
          fontStyle: 'bold',
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
    } else if (activeTab === 'achats') {
      autoTable(doc, {
        startY: 44,
        margin: { bottom: 18 },
        head: [
          [
            'N° Reçu',
            'Date',
            'Produit',
            'Catégorie',
            'Fournisseur',
            'Qté',
            'Prix Unitaire',
            'Prix Total',
          ],
        ],
        body: report.achats.map((a) => [
          a.numero_recu,
          formatDateTime(a.date_achat),
          a.produit_nom || '-',
          a.categorie_nom || '-',
          a.fournisseur_nom,
          `${formatNumber(a.quantite)} ${a.unite || ''}`,
          formatFCFA(a.prix_unitaire),
          formatFCFA(a.prix_total),
        ]),
        foot: [
          [
            'TOTAL ACHATS',
            '',
            '',
            '',
            `${formatNumber(report.resume.nombre_achats)} entrée(s)`,
            `${formatNumber(report.resume.produits_achetes)} unités`,
            '',
            formatFCFA(report.resume.total_achats),
          ],
        ],
        headStyles: { fillColor: [4, 120, 87], textColor: 255, fontSize: 8.5 },
        bodyStyles: { fontSize: 8 },
        footStyles: {
          fillColor: [236, 253, 245],
          textColor: [6, 95, 70],
          fontSize: 8.5,
          fontStyle: 'bold',
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
    } else if (activeTab === 'stock') {
      const totalDispo = report.stock.reduce(
        (acc, s) => acc + Number(s.quantite_disponible || 0),
        0
      );
      autoTable(doc, {
        startY: 44,
        margin: { bottom: 18 },
        head: [['Produit', 'Catégorie', 'Entrées', 'Sorties', 'Disponible (Reste)', 'Seuil', 'Statut']],
        body: report.stock.map((s) => [
          s.produit_nom,
          s.categorie_nom || '-',
          `+${formatNumber(s.total_entrees)}`,
          `-${formatNumber(s.total_sorties)}`,
          `${formatNumber(s.quantite_disponible)} ${s.unite}`,
          formatNumber(s.seuil_alerte),
          s.statut,
        ]),
        foot: [
          [
            'TOTAL STOCK',
            `${formatNumber(report.stock.length)} produit(s)`,
            '',
            '',
            `${formatNumber(totalDispo)} unités`,
            '',
            '',
          ],
        ],
        headStyles: { fillColor: [4, 120, 87], textColor: 255, fontSize: 8.5 },
        bodyStyles: { fontSize: 8 },
        footStyles: {
          fillColor: [236, 253, 245],
          textColor: [6, 95, 70],
          fontSize: 8.5,
          fontStyle: 'bold',
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
    } else if (activeTab === 'produits') {
      autoTable(doc, {
        startY: 44,
        margin: { bottom: 18 },
        head: [
          ['Produit', 'Catégorie', "Prix d'achat", 'Qté Vendue', 'Chiffre Affaires', 'Stock Dispo'],
        ],
        body: report.produits.map((p) => [
          p.nom,
          p.categorie_nom || '-',
          formatFCFA(p.prix_achat),
          formatNumber(p.qte_vendue_periode),
          formatFCFA(p.ca_periode),
          `${formatNumber(p.stock_disponible)} ${p.unite}`,
        ]),
        headStyles: { fillColor: [4, 120, 87], textColor: 255, fontSize: 8.5 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
    } else if (activeTab === 'clients') {
      autoTable(doc, {
        startY: 44,
        margin: { bottom: 18 },
        head: [
          [
            'Client',
            'Téléphone',
            'Adresse',
            'Email',
            'Nb Achats',
            'Quantité Totale',
            "Chiffre d'Affaires",
          ],
        ],
        body: report.clients.map((c) => [
          c.nom_complet,
          c.telephone || '-',
          c.adresse || '-',
          c.email || '-',
          formatNumber(c.nombre_ventes),
          formatNumber(c.quantite_totale),
          formatFCFA(c.chiffre_affaires),
        ]),
        headStyles: { fillColor: [4, 120, 87], textColor: 255, fontSize: 8.5 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
    } else {
      autoTable(doc, {
        startY: 44,
        margin: { bottom: 18 },
        head: [
          [
            'Fournisseur',
            'Téléphone',
            'Adresse',
            'Email',
            'Nb Livraisons',
            'Quantité Totale',
            'Montant Total',
          ],
        ],
        body: report.fournisseurs.map((f) => [
          f.nom_complet,
          f.telephone || '-',
          f.adresse || '-',
          f.email || '-',
          formatNumber(f.nombre_achats),
          formatNumber(f.quantite_totale),
          formatFCFA(f.montant_total),
        ]),
        headStyles: { fillColor: [4, 120, 87], textColor: 255, fontSize: 8.5 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
    }

    addPageFooters(doc, titles[activeTab] || 'Rapport');
    doc.save(`RAPPORT_${activeTab.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.pdf`);
  },

  /**
   * Exports chronological operations history (sales + purchases) to PDF
   */
  exportHistoryToPDF(
    operations: Array<{
      type: 'VENTE' | 'ENTREE';
      numero_recu: string;
      date_op: string;
      produit_nom: string;
      categorie_nom: string;
      unite: string;
      quantite: number;
      prix_unitaire: number;
      prix_total: number;
      partenaire_nom: string;
    }>,
    summary: {
      totalVentes: number;
      countVentes: number;
      totalAchats: number;
      countAchats: number;
    },
    periodLabel: string
  ) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(4, 120, 87);
    doc.rect(0, 0, pageWidth, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('HISTORIQUE CHRONOLOGIQUE DES OPÉRATIONS (VENTES & ACHATS)', 14, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Filtre : ${periodLabel}`, 14, 18);
    doc.text(`Édité le ${formatDateTime(new Date().toISOString())}`, pageWidth - 14, 14, {
      align: 'right',
    });

    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(14, 28, pageWidth - 28, 12, 2, 2, 'FD');
    doc.setTextColor(6, 95, 70);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const summaryLine = `Ventes : ${summary.countVentes} (${formatFCFA(
      summary.totalVentes
    )})   |   Achats / Entrées : ${summary.countAchats} (${formatFCFA(
      summary.totalAchats
    )})   |   Total opérations : ${operations.length}`;
    doc.text(summaryLine, 18, 35.5);

    autoTable(doc, {
      startY: 44,
      margin: { bottom: 18 },
      head: [
        [
          'Date & Heure',
          'Type',
          'N° Reçu',
          'Produit',
          'Catégorie',
          'Client / Fournisseur',
          'Quantité',
          'Prix Unitaire',
          'Montant Total',
        ],
      ],
      body: operations.map((op) => [
        formatDateTime(op.date_op),
        op.type === 'VENTE' ? 'VENTE' : 'ACHAT / ENTRÉE',
        op.numero_recu,
        op.produit_nom,
        op.categorie_nom,
        op.partenaire_nom,
        `${op.type === 'VENTE' ? '-' : '+'}${formatNumber(op.quantite)} ${op.unite}`,
        formatFCFA(op.prix_unitaire),
        formatFCFA(op.prix_total),
      ]),
      headStyles: { fillColor: [4, 120, 87], textColor: 255, fontSize: 8.5 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    addPageFooters(doc, 'Historique des Opérations');
    doc.save(`HISTORIQUE_OPERATIONS_${new Date().toISOString().slice(0, 10)}.pdf`);
  },
};
