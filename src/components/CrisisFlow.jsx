import React, { useState, useMemo } from "react";

export default function CrisisFlow({ crises, initialMetrics, initialResources }) {
  const crisisKeys = useMemo(() => Object.keys(crises), [crises]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState("story"); // story | advisors | actions | result | end
  const [metrics, setMetrics] = useState(initialMetrics);
  const [resources, setResources] = useState(initialResources);

  const [metricsBefore, setMetricsBefore] = useState(initialMetrics);
  const [immediateText, setImmediateText] = useState("");
  const [delayedText, setDelayedText] = useState("");

  if (!crisisKeys.length) return <div>Tanımlı kriz yok.</div>;

  if (phase === "end") {
    return (
      <EndScreen
        metrics={metrics}
        resources={resources}
        onRestart={() => {
          setMetrics(initialMetrics);
          setResources(initialResources);
          setCurrentIndex(0);
          setPhase("story");
        }}
      />
    );
  }

  const crisisKey = crisisKeys[currentIndex];
  const crisis = crises[crisisKey];

  return (
    <div style={styles.wrapper}>
      <Header crisis={crisis} index={currentIndex} total={crisisKeys.length} />

      {phase === "story" && (
        <StoryPhase story={crisis.story} onNext={() => setPhase("advisors")} />
      )}

      {phase === "advisors" && (
        <AdvisorsPhase advisors={crisis.advisors} onNext={() => setPhase("actions")} />
      )}

      {phase === "actions" && (
        <ActionsPhase
          crisis={crisis}
          metrics={metrics}
          resources={resources}
          onMetricsBefore={setMetricsBefore}
          onApply={(m, r, imm, delayed) => {
            setMetrics(m);
            setResources(r);
            setImmediateText(imm);
            setDelayedText(delayed);
            setPhase("result");
          }}
        />
      )}

      {phase === "result" && (
        <ResultPhase
          metricsBefore={metricsBefore}
          metricsAfter={metrics}
          immediateText={immediateText}
          delayedText={delayedText}
          onNext={() => {
            const next = currentIndex + 1;
            if (next < crisisKeys.length) {
              setCurrentIndex(next);
              setPhase("story");
            } else {
              setPhase("end");
            }
          }}
        />
      )}

      <MetricsBar metrics={metrics} resources={resources} />
    </div>
  );
}

/* ---------------------------------------------------
   COMPONENTS
--------------------------------------------------- */

function Header({ crisis, index, total }) {
  const icon = crisis.icon || "🧩";
  return (
    <div style={styles.header}>
      <div style={styles.headerLeft}>
        <span style={styles.headerIcon}>{icon}</span>
        <div>
          <div style={styles.headerTitle}>{crisis.title}</div>
          <div style={styles.headerSubtitle}>Kriz {index + 1} / {total}</div>
        </div>
      </div>
    </div>
  );
}

function StoryPhase({ story, onNext }) {
  return (
    <div style={styles.main}>
      <h2 style={styles.phaseTitle}>Durum Özeti</h2>
      <p style={styles.storyText}>{story}</p>
      <div style={styles.actionsRow}>
        <button style={styles.primaryButton} onClick={onNext}>
          Danışmanları Dinle
        </button>
      </div>
    </div>
  );
}

function AdvisorsPhase({ advisors, onNext }) {
  return (
    <div style={styles.main}>
      <h2 style={styles.phaseTitle}>Danışman Görüşleri</h2>
      <div style={styles.advisorsGrid}>
        {advisors.map((a, i) => (
          <div key={i} style={styles.advisorCard}>
            <div style={styles.advisorName}>{a.name}</div>
            <div style={styles.advisorText}>{a.text}</div>
          </div>
        ))}
      </div>

      <div style={styles.actionsRow}>
        <button style={styles.primaryButton} onClick={onNext}>Karar Ver</button>
      </div>
    </div>
  );
}

function ActionsPhase({ crisis, metrics, resources, onMetricsBefore, onApply }) {
  const actions = crisis.actions;

  const selectAction = (action) => {
    // Kaynak kontrolü
    if (resources.budget < action.cost_budget || resources.hr < action.cost_hr) {
      alert("Kaynak yetersiz.");
      return;
    }

    const before = { ...metrics };
    onMetricsBefore(before);

    let m = { ...metrics };
    let r = { ...resources };

    r.budget -= action.cost_budget;
    r.hr -= action.cost_hr;

    const clamp = (v) => Math.max(0, Math.min(100, v ?? 0));

    m.security = clamp(m.security + (action.delta_security || 0));
    m.freedom = clamp(m.freedom + (action.delta_freedom || 0));
    m.public_trust = clamp(m.public_trust + (action.delta_public_trust || 0));
    m.resilience = clamp(m.resilience + (action.delta_resilience || 0));

    // gecikmeli etki
    if (action.id === "C") {
      m.resilience = clamp(m.resilience + 8);
      m.public_trust = clamp(m.public_trust + 4);
    } else {
      m.resilience = clamp(m.resilience + 4);
      if (action.id === "A") {
        m.public_trust = clamp(m.public_trust - 3);
      }
    }

    const immediate = crisis.immediate_text.replace("{action}", action.name);
    const delayed = crisis.delayed_text;

    onApply(m, r, immediate, delayed);
  };

  return (
    <div style={styles.main}>
      <h2 style={styles.phaseTitle}>Aksiyon Seç</h2>
      <div style={styles.actionsGrid}>
        {actions.map((a) => (
          <button
            key={a.id}
            style={styles.actionCard}
            onClick={() => selectAction(a)}
          >
            <div style={styles.actionTitle}>{a.name}</div>
            <div style={styles.actionTooltip}>{a.tooltip}</div>
            <div style={styles.actionCosts}>
              💰 {a.cost_budget} | 👥 {a.cost_hr}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultPhase({ metricsBefore, metricsAfter, immediateText, delayedText, onNext }) {
  const n = (v) => (typeof v === "number" ? v.toFixed(1) : "-");
  const diff = (a, b) => {
    const d = (a - b).toFixed(1);
    return d > 0 ? "+" + d : d;
  };

  return (
    <div style={styles.main}>
      <h2 style={styles.phaseTitle}>Sonuçlar</h2>

      <p style={styles.storyText}>{immediateText}</p>
      <p style={styles.storyText}>{delayedText}</p>

      <div style={styles.resultGrid}>
        <div style={styles.resultLine}>
          🛡️ Güvenlik: {n(metricsBefore.security)} → {n(metricsAfter.security)}
          <span style={styles.diffText}> ({diff(metricsAfter.security, metricsBefore.security)})</span>
        </div>

        <div style={styles.resultLine}>
          🗽 Özgürlük: {n(metricsBefore.freedom)} → {n(metricsAfter.freedom)}
          <span style={styles.diffText}> ({diff(metricsAfter.freedom, metricsBefore.freedom)})</span>
        </div>

        <div style={styles.resultLine}>
          🤝 Kamu Güveni: {n(metricsBefore.public_trust)} → {n(metricsAfter.public_trust)}
          <span style={styles.diffText}> ({diff(metricsAfter.public_trust, metricsBefore.public_trust)})</span>
        </div>

        <div style={styles.resultLine}>
          💪 Dayanıklılık: {n(metricsBefore.resilience)} → {n(metricsAfter.resilience)}
          <span style={styles.diffText}> ({diff(metricsAfter.resilience, metricsBefore.resilience)})</span>
        </div>
      </div>

      <div style={styles.actionsRow}>
        <button style={styles.primaryButton} onClick={onNext}>Sonraki Kriz</button>
      </div>
    </div>
  );
}

function EndScreen({ metrics, resources, onRestart }) {
  const score = ((metrics.security + metrics.freedom + metrics.public_trust) / 3).toFixed(1);

  return (
    <div style={styles.main}>
      <h2 style={styles.phaseTitle}>Oyun Bitti</h2>
      <p style={styles.storyText}>Genel Liderlik Skoru: {score}</p>

      <div style={styles.actionsRow}>
        <button style={styles.primaryButton} onClick={onRestart}>
          Baştan Oyna
        </button>
      </div>
    </div>
  );
}

function MetricsBar({ metrics, resources }) {
  const n = (v) => (typeof v === "number" ? v.toFixed(1) : "-");

  return (
    <div style={styles.metricsBar}>
      <span>💰 Bütçe: {resources.budget}</span>
      <span>👥 İnsan: {resources.hr}</span>
      <span>🛡️ Güvenlik: {n(metrics.security)}</span>
      <span>🗽 Özgürlük: {n(metrics.freedom)}</span>
      <span>🤝 Güven: {n(metrics.public_trust)}</span>
      <span>💪 Dayanıklılık: {n(metrics.resilience)}</span>
    </div>
  );
}

/* ---------------------------------------------------
   STYLES
--------------------------------------------------- */

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 12
  },
  header: {
    display: "flex",
    justifyContent: "space-between"
  },
  headerLeft: {
    display: "flex",
    gap: 12,
    alignItems: "center"
  },
  headerIcon: { fontSize: 26 },
  headerTitle: { fontSize: 22, fontWeight: 600 },
  headerSubtitle: { fontSize: 13, color: "#9ca3af" },

  main: {
    border: "1px solid #1f2937",
    borderRadius: 12,
    padding: 16,
    background: "#020617"
  },

  phaseTitle: { margin: 0, marginBottom: 8, fontSize: 20, color: "#a5b4fc" },
  storyText: { fontSize: 15, color: "#e5e7eb" },

  advisorsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12
  },
  advisorCard: {
    border: "1px solid #374151",
    padding: 12,
    borderRadius: 10,
    background: "#111827"
  },
  advisorName: { fontSize: 15, fontWeight: 600, color: "#38bdf8", marginBottom: 6 },
  advisorText: { fontSize: 13, color: "#e5e7eb" },

  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12
  },
  actionCard: {
    padding: 12,
    background: "#0f172a",
    border: "1px solid #374151",
    borderRadius: 10,
    cursor: "pointer",
    textAlign: "left"
  },
  actionTitle: { fontSize: 16, fontWeight: 600, color: "#f472b6" },
  actionTooltip: { fontSize: 13, color: "#e5e7eb", marginBottom: 8 },
  actionCosts: { fontSize: 12, color: "#9ca3af" },

  resultGrid: {
    marginTop: 12,
    display: "grid",
    gap: 6
  },
  resultLine: { fontSize: 15 },
  diffText: { color: "#60a5fa", marginLeft: 4 },

  actionsRow: { display: "flex", justifyContent: "center", marginTop: 16 },
  primaryButton: {
    padding: "10px 20px",
    borderRadius: 999,
    background: "linear-gradient(to right, #22c55e, #14b8a6)",
    border: "none",
    cursor: "pointer",
    fontWeight: 600
  },

  metricsBar: {
    marginTop: 8,
    paddingTop: 8,
    borderTop: "1px solid #1f2937",
    display: "flex",
    gap: 16,
    fontSize: 13,
    color: "#9ca3af",
    flexWrap: "wrap"
  }
};
