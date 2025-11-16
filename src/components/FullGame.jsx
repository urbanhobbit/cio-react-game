import React, { useState, useMemo } from "react";
import scenariosData from "../data/scenarios.json";
import config from "../data/config.json";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/**
 * Streamlit app04.py mantığının React’e taşınmış, eğitim modlu tam sürümü.
 */

const initialSettings = config.initial_settings;
const balance = config.game_balance;

const cloneMetrics = () => ({ ...initialSettings.metrics });

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v));

export default function FullGame() {
  const allScenarioIds = useMemo(() => Object.keys(scenariosData), []);

  const [screen, setScreen] = useState("start"); // start | tutorial | story | advisors | decision | immediate | delayed | report | end
  const [metrics, setMetrics] = useState(cloneMetrics);
  const [budget, setBudget] = useState(initialSettings.budget);
  const [hr, setHr] = useState(initialSettings.hr);
  const [crisisSequence, setCrisisSequence] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);
  const [news, setNews] = useState(["Oyun başladı. Ülke durumu stabil."]);
  const [history, setHistory] = useState([cloneMetrics()]);
  const [decision, setDecision] = useState({});
  const [results, setResults] = useState(null);
  const [metricsBefore, setMetricsBefore] = useState(cloneMetrics);
  const [selectedIds, setSelectedIds] = useState(new Set(allScenarioIds));

  const currentScenario =
    selectedScenarioId != null ? scenariosData[selectedScenarioId] : null;

  const maxCrises = initialSettings.max_crises || 3;

  const addNews = (headline) => {
    setNews((prev) => {
      const next = [headline, ...prev];
      return next.slice(0, 5);
    });
  };

  const resetGame = () => {
    setScreen("start");
    setMetrics(cloneMetrics());
    setBudget(initialSettings.budget);
    setHr(initialSettings.hr);
    setCrisisSequence([]);
    setCurrentIndex(0);
    setSelectedScenarioId(null);
    setNews(["Oyun yeniden başlatıldı. Ülke durumu stabil."]);
    setHistory([cloneMetrics()]);
    setDecision({});
    setResults(null);
    setSelectedIds(new Set(allScenarioIds));
  };

  // withTutorial = true → önce eğitim, sonra ilk krizin story ekranı
  const startGame = (withTutorial = false) => {
    const ids =
      selectedIds.size > 0 ? Array.from(selectedIds) : [...allScenarioIds];
    const seq = shuffle(ids).slice(0, maxCrises);
    if (!seq.length) return;

    setCrisisSequence(seq);
    setCurrentIndex(0);
    setSelectedScenarioId(seq[0]);
    setHistory([cloneMetrics()]);
    setScreen(withTutorial ? "tutorial" : "story");
  };

  const calculateEffects = (action, scope, duration, safeguards) => {
    const THREAT_SEVERITY = balance.THREAT_SEVERITY;
    const RANDOM_FACTOR_RANGE = balance.RANDOM_FACTOR_RANGE;
    const SCOPE_MULTIPLIERS = balance.SCOPE_MULTIPLIERS;
    const DURATION_MULTIPLIERS = balance.DURATION_MULTIPLIERS;
    const SAFEGUARD_QUALITY_PER_ITEM = balance.SAFEGUARD_QUALITY_PER_ITEM;
    const TRUST_BOOST_FOR_TRANSPARENCY =
      balance.TRUST_BOOST_FOR_TRANSPARENCY;
    const FATIGUE_PER_DURATION = balance.FATIGUE_PER_DURATION;

    const randomFactor =
      Math.random() *
        (RANDOM_FACTOR_RANGE[1] - RANDOM_FACTOR_RANGE[0]) +
      RANDOM_FACTOR_RANGE[0];

    const scopeMultiplier = SCOPE_MULTIPLIERS[scope];
    const durationMultiplier = DURATION_MULTIPLIERS[duration];
    const safeguardQuality =
      (safeguards?.length || 0) * SAFEGUARD_QUALITY_PER_ITEM;

    let securityChange =
      (THREAT_SEVERITY * action.security_effect) / 100 -
      action.side_effect_risk * randomFactor * 20;

    let freedomCost =
      action.freedom_cost *
      scopeMultiplier *
      durationMultiplier *
      (1 - safeguardQuality * action.safeguard_reduction);

    let publicTrustChange =
      (safeguards?.includes("transparency")
        ? TRUST_BOOST_FOR_TRANSPARENCY
        : 0) - freedomCost * 0.5;

    let resilienceChange =
      action.speed === "slow"
        ? (action.security_effect * safeguardQuality) / 2
        : 5;

    let fatigueChange =
      DURATION_MULTIPLIERS[duration] * FATIGUE_PER_DURATION[scope];

    if (securityChange > 15) {
      addNews(`📈 GÜVENLİK ARTTI: '${action.name}' sonrası tehdit seviyesi düştü.`);
    }
    if (freedomCost > 15) {
      addNews(
        "📉 ÖZGÜRLÜK TARTIŞMASI: Yeni kısıtlamalar sivil toplumdan tepki çekti."
      );
    }
    if (safeguards?.includes("transparency")) {
      addNews(
        "📰 ŞEFFAFLIK ADIMI: Hükümet atılan adımlarla ilgili detaylı rapor yayımladı."
      );
    }

    const counter_factual =
      action.id === "A"
        ? "B veya C ile benzer güvenliği daha düşük özgürlük maliyetiyle sağlayabilirdiniz."
        : "Bu seçim görece orantılı; kullandığınız güvenceler fark yarattı.";

    const nextMetrics = {
      security: clamp(metrics.security + securityChange),
      freedom: clamp(metrics.freedom - freedomCost),
      public_trust: clamp(metrics.public_trust + publicTrustChange),
      resilience: clamp(metrics.resilience + resilienceChange),
      fatigue: clamp(metrics.fatigue + fatigueChange),
    };

    const nextBudget = budget - action.cost;
    const nextHr = hr - action.hr_cost;

    return {
      metrics: nextMetrics,
      budget: nextBudget,
      hr: nextHr,
      counter_factual,
    };
  };

  const calculateSkipTurnEffects = () => {
    addNews(
      "🚨 KAYNAK YETERSİZ: Hükümet, kaynak yetersizliği nedeniyle krize müdahale edemedi."
    );

    const securityPenalty = -25;
    const trustPenalty = -20;
    const resiliencePenalty = -10;
    const fatigueIncrease = 15;

    const nextMetrics = {
      security: clamp(metrics.security + securityPenalty),
      freedom: metrics.freedom,
      public_trust: clamp(metrics.public_trust + trustPenalty),
      resilience: clamp(metrics.resilience + resiliencePenalty),
      fatigue: clamp(metrics.fatigue + fatigueIncrease),
    };

    return {
      metrics: nextMetrics,
      budget,
      hr,
      counter_factual:
        "Kaynaklarınızı daha verimli kullanmış olsaydınız, bu krize müdahale edebilir ve daha büyük zararları önleyebilirdiniz.",
    };
  };

  if (screen === "start") {
    return (
      <div style={styles.wrapper}>
        <HeaderSimple />
        <StartScreen
          allScenarioIds={allScenarioIds}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          onStart={() => startGame(false)}
          onStartTutorial={() => startGame(true)}
        />
      </div>
    );
  }

  if (!currentScenario) {
    return (
      <div style={styles.wrapper}>
        <p>Senaryo bulunamadı. Oyunu yeniden başlat.</p>
        <button style={styles.primaryButton} onClick={resetGame}>
          Yeniden Başlat
        </button>
      </div>
    );
  }

  const goNextCrisisOrEnd = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < crisisSequence.length) {
      const nextId = crisisSequence[nextIndex];
      setCurrentIndex(nextIndex);
      setSelectedScenarioId(nextId);
      setScreen("story");
      setHistory((h) => [...h, { ...metrics }]);
      setDecision({});
      setResults(null);
    } else {
      setScreen("end");
    }
  };

  return (
    <div style={styles.wrapper}>
      <HeaderWithStatus
        scenario={currentScenario}
        index={currentIndex}
        total={crisisSequence.length}
      />

      <div style={styles.mainRow}>
        <div style={styles.mainCard}>
          {screen === "tutorial" && (
            <TutorialScreen
              metrics={metrics}
              budget={budget}
              hr={hr}
              onNext={() => setScreen("story")}
            />
          )}

          {screen === "story" && (
            <StoryScreen
              scenario={currentScenario}
              onNext={() => setScreen("advisors")}
            />
          )}

          {screen === "advisors" && (
            <AdvisorsScreen
              scenario={currentScenario}
              news={news}
              onNext={() => setScreen("decision")}
            />
          )}

          {screen === "decision" && (
            <DecisionScreen
              scenario={currentScenario}
              metrics={metrics}
              budget={budget}
              hr={hr}
              onSkip={() => {
                setMetricsBefore({ ...metrics });
                const res = calculateSkipTurnEffects();
                setResults(res);
                setMetrics(res.metrics);
                setBudget(res.budget);
                setHr(res.hr);
                setDecision({ skipped: true });
                setScreen("immediate");
              }}
              onApply={(opts) => {
                const { action, scope, duration, safeguards } = opts;
                setMetricsBefore({ ...metrics });
                const res = calculateEffects(
                  action,
                  scope,
                  duration,
                  safeguards
                );
                setResults({
                  ...res,
                  actionId: action.id,
                  actionName: action.name,
                  scope,
                  duration,
                  safeguards,
                  skipped: false,
                });
                setMetrics(res.metrics);
                setBudget(res.budget);
                setHr(res.hr);
                setDecision({
                  actionId: action.id,
                  scope,
                  duration,
                  safeguards,
                  skipped: false,
                });
                setScreen("immediate");
              }}
            />
          )}

          {screen === "immediate" && results && (
            <ImmediateScreen
              scenario={currentScenario}
              results={results}
              metricsBefore={metricsBefore}
              metricsAfter={metrics}
              onNext={() => setScreen("delayed")}
            />
          )}

          {screen === "delayed" && results && (
            <DelayedScreen
              scenario={currentScenario}
              results={results}
              metrics={metrics}
              onNext={() => setScreen("report")}
            />
          )}

          {screen === "report" && results && (
            <ReportScreen
              metricsBefore={history[currentIndex]}
              metricsAfter={metrics}
              results={results}
              onNext={goNextCrisisOrEnd}
            />
          )}

          {screen === "end" && (
            <EndScreen
              metrics={metrics}
              budget={budget}
              hr={hr}
              history={history}
              onRestart={resetGame}
            />
          )}
        </div>

        <div style={styles.sideCard}>
          <NewsTicker news={news} />
          <MetricsPanel metrics={metrics} budget={budget} hr={hr} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------- Headerlar ---------------------- */

function HeaderSimple() {
  return (
    <div style={styles.header}>
      <div style={styles.headerLeft}>
        <span style={styles.headerIcon}>🛡️</span>
        <div>
          <div style={styles.headerTitle}>CIO Kriz Yönetimi Oyunu</div>
          <div style={styles.headerSubtitle}>
            Bilgi düzensizlikleri ve haklar arasında denge kur.
          </div>
        </div>
      </div>
      <div style={styles.headerBadge}>Tam Sürüm (React)</div>
    </div>
  );
}

function HeaderWithStatus({ scenario, index, total }) {
  return (
    <div style={styles.header}>
      <div style={styles.headerLeft}>
        <span style={styles.headerIcon}>{scenario.icon || "🧩"}</span>
        <div>
          <div style={styles.headerTitle}>{scenario.title}</div>
          <div style={styles.headerSubtitle}>
            Kriz {index + 1} / {total || "?"}
          </div>
        </div>
      </div>
      <div style={styles.headerBadge}>CIO Kriz Yönetimi</div>
    </div>
  );
}

/* ---------------------- Start + Tutorial ---------------------- */

function StartScreen({
  allScenarioIds,
  selectedIds,
  setSelectedIds,
  onStart,
  onStartTutorial,
}) {
  const toggleId = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div style={styles.mainCard}>
      <h2 style={styles.phaseTitle}>Hoş Geldin!</h2>
      <p style={styles.storyText}>
        Bu oyunda ... adasının bilgi şefisin. Deprem, yangın, salgın ve seçim
        gibi krizlerde hem güvenliği sağlamak hem de ifade özgürlüğü ve
        mahremiyeti korumak senin görevin.
      </p>
      <p style={styles.storyText}>
        Her kriz kartında danışmanları dinleyecek, aksiyon kartlarından birini
        seçecek ve kapsam, süre ile güvenceleri ayarlayacaksın. Seçimlerin;
        güvenlik, özgürlük, kamu güveni, dayanıklılık, uyum yorgunluğu ile
        bütçe ve insan kaynağını etkileyecek.
      </p>

      <div style={{ marginTop: 12 }}>
        <h3 style={styles.sideTitle}>Bu oyunda oynanacak krizler</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {allScenarioIds.map((id) => (
            <label
              key={id}
              style={{
                borderRadius: 999,
                border: selectedIds.has(id)
                  ? "1px solid #38bdf8"
                  : "1px solid #374151",
                padding: "4px 10px",
                fontSize: 13,
                cursor: "pointer",
                background: selectedIds.has(id) ? "#0f172a" : "#020617",
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(id)}
                onChange={() => toggleId(id)}
                style={{ marginRight: 6 }}
              />
              {scenariosData[id].icon} {scenariosData[id].title}
            </label>
          ))}
        </div>
      </div>

      <div style={{ ...styles.actionsRow, gap: 8 }}>
        <button style={styles.primaryButton} onClick={onStartTutorial}>
          🎓 Eğitimle Başla
        </button>
        <button
          style={{
            ...styles.primaryButton,
            background: "linear-gradient(to right,#64748b,#0f172a)",
            color: "#e5e7eb",
          }}
          onClick={onStart}
        >
          ⚡ Doğrudan Oyuna Başla
        </button>
      </div>
    </div>
  );
}

function TutorialScreen({ metrics, budget, hr, onNext }) {
  const [demoMetrics, setDemoMetrics] = useState({
    security: 50,
    freedom: 50,
    public_trust: 50,
    resilience: 50,
    fatigue: 10,
  });

  const applyDemo = (type) => {
    setDemoMetrics((prev) => {
      let next = { ...prev };
      if (type === "security_first") {
        next.security = clamp(prev.security + 20, 0, 100);
        next.freedom = clamp(prev.freedom - 15, 0, 100);
        next.public_trust = clamp(prev.public_trust - 5, 0, 100);
        next.resilience = clamp(prev.resilience + 5, 0, 100);
        next.fatigue = clamp(prev.fatigue + 10, 0, 100);
      } else if (type === "freedom_first") {
        next.security = clamp(prev.security + 5, 0, 100);
        next.freedom = clamp(prev.freedom + 15, 0, 100);
        next.public_trust = clamp(prev.public_trust + 10, 0, 100);
        next.resilience = clamp(prev.resilience + 8, 0, 100);
        next.fatigue = clamp(prev.fatigue + 3, 0, 100);
      }
      return next;
    });
  };

  return (
    <>
      <h2 style={styles.phaseTitle}>Kısa Eğitim (Deneme Tur)</h2>
      <p style={styles.storyText}>
        Oyunda her turda üç şeye bakacaksın: (1) Kriz kartının hikâyesi, (2)
        Danışmanların önerileri, (3) Aksiyon kartı + kapsam, süre ve
        güvenceler. Sağdaki panel, krizin ülkenin dengelerini nasıl etkilediğini
        gösteriyor.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: 10,
          marginTop: 8,
        }}
      >
        <div style={styles.advisorCard}>
          <div style={styles.advisorName}>Gösterge Paneli</div>
          <div style={styles.advisorText}>
            <strong>Güvenlik</strong>, tehdidin ne kadar kontrol altında
            olduğunu; <strong>Özgürlük</strong>, hak ve özgürlüklerin ne kadar
            korunduğunu; <strong>Kamu Güveni</strong> ise vatandaşların
            hükümete duyduğu güveni gösterir.{" "}
            <strong>Dayanıklılık</strong>, gelecekteki krizlere hazırlığı;{" "}
            <strong>Uyum yorgunluğu</strong> ise insanların sürekli yeni
            kurallara uyma isteğinin ne kadar azaldığını anlatır.
          </div>
        </div>

        <div style={styles.advisorCard}>
          <div style={styles.advisorName}>Aksiyon Kartı</div>
          <div style={styles.advisorText}>
            Her aksiyon kartının bir <strong>güvenlik etkisi</strong>, bir{" "}
            <strong>özgürlük maliyeti</strong> ve{" "}
            <strong>yan etki riski</strong> vardır. Kartı seçtikten sonra,{" "}
            <strong>kapsam</strong> (hedefli/genel), <strong>süre</strong>{" "}
            (kısa/orta/uzun) ve <strong>güvenceler</strong> (şeffaflık, itiraz
            mekanizması, otomatik sona erdirme) ile orantılılığı ayarlarsın.
          </div>
        </div>

        <div style={styles.advisorCard}>
          <div style={styles.advisorName}>Kaynaklar</div>
          <div style={styles.advisorText}>
            Her politika <strong>bütçe</strong> ve{" "}
            <strong>insan kaynağı</strong> tüketir. Kaynaklar çok düşerse bazı
            turlarda hiç aksiyon alamazsın; bu da hem güvenlik hem de
            meşruiyet açısından ağır bir maliyet yaratır.
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 10,
          borderRadius: 10,
          border: "1px solid #374151",
          background: "#020617",
          display: "grid",
          gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1.2fr)",
          gap: 10,
        }}
      >
        <div>
          <div style={{ marginBottom: 6, fontSize: 14, fontWeight: 600 }}>
            Kısa deneme: iki farklı kararın etkisini gör
          </div>
          <p style={{ ...styles.storyText, fontSize: 13 }}>
            Aşağıdaki butonlardan birine basarak, güvenlik odaklı veya özgürlük
            odaklı bir kararın göstergeleri nasıl değiştirdiğini deneyebilirsin.
            Bu sadece eğitim amaçlı; gerçek oyundaki metriklerini etkilemez.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              style={styles.primaryButton}
              onClick={() => applyDemo("security_first")}
            >
              🛡️ Güvenlik odaklı dene
            </button>
            <button
              style={{
                ...styles.primaryButton,
                background:
                  "linear-gradient(to right, #22d3ee, #6366f1)",
              }}
              onClick={() => applyDemo("freedom_first")}
            >
              🗽 Özgürlük odaklı dene
            </button>
          </div>
        </div>

        <div>
          <div
            style={{
              marginBottom: 4,
              fontSize: 13,
              color: "#a5b4fc",
            }}
          >
            Deneme göstergeleri
          </div>
          <TutorialMetricBar label="🛡️ Güvenlik" value={demoMetrics.security} />
          <TutorialMetricBar label="🗽 Özgürlük" value={demoMetrics.freedom} />
          <TutorialMetricBar
            label="🤝 Kamu Güveni"
            value={demoMetrics.public_trust}
          />
          <TutorialMetricBar
            label="💪 Dayanıklılık"
            value={demoMetrics.resilience}
          />
          <TutorialMetricBar
            label="😩 Uyum Yorgunluğu"
            value={demoMetrics.fatigue}
          />
        </div>
      </div>

      <p style={{ ...styles.storyText, fontSize: 13, marginTop: 10 }}>
        Hazırsan şimdi gerçek krizlere geçebilirsin. İlk krizde sadece arayüzü
        tanımaya ve metriklerin nasıl oynadığını gözlemlemeye odaklan.
      </p>

      <div style={styles.actionsRow}>
        <button style={styles.primaryButton} onClick={onNext}>
          Eğitimi bitir, oyuna başla
        </button>
      </div>
    </>
  );
}

/* ---------------------- Story ---------------------- */

function StoryScreen({ scenario, onNext }) {
  const [reportPart, missionPart] = useMemo(() => {
    const marker = "**Görev**:";
    const idx = scenario.story.indexOf(marker);
    if (idx === -1) return [scenario.story, ""];
    return [
      scenario.story.slice(0, idx),
      scenario.story.slice(idx + marker.length),
    ];
  }, [scenario.story]);

  return (
    <>
      <h2 style={styles.phaseTitle}>Durum Özeti</h2>
      <p style={styles.storyText}>{reportPart}</p>
      {missionPart && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #4b5563",
            background: "#020617",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15, color: "#f97316" }}>Görev</h3>
          <p style={{ ...styles.storyText, marginTop: 6 }}>{missionPart}</p>
        </div>
      )}
      <div style={styles.actionsRow}>
        <button style={styles.primaryButton} onClick={onNext}>
          Danışmanları dinle
        </button>
      </div>
    </>
  );
}

/* ---------------------- Advisors ---------------------- */

function AdvisorsScreen({ scenario, news, onNext }) {
  return (
    <>
      <h2 style={styles.phaseTitle}>Danışman Görüşleri</h2>
      <p style={styles.storyText}>
        Farklı danışmanlar sana farklı değerleri öne çıkaran çözümler sunuyor.
        Sadece “güvenlik” değil, özgürlük ve meşruiyet maliyetini de düşün.
      </p>
      <div style={styles.advisorsGrid}>
        {scenario.advisors.map((a, i) => (
          <div key={i} style={styles.advisorCard}>
            <div style={styles.advisorName}>{a.name}</div>
            <div style={styles.advisorText}>{a.text}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <NewsTicker news={news} compact />
      </div>
      <div style={styles.actionsRow}>
        <button style={styles.primaryButton} onClick={onNext}>
          Karar aşamasına geç
        </button>
      </div>
    </>
  );
}

/* ---------------------- Decision ---------------------- */

function DecisionScreen({
  scenario,
  metrics,
  budget,
  hr,
  onSkip,
  onApply,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [scope, setScope] = useState("targeted");
  const [duration, setDuration] = useState("short");
  const [safeguards, setSafeguards] = useState(new Set());

  const affordable = scenario.action_cards.filter(
    (c) => budget >= c.cost && hr >= c.hr_cost
  );

  const toggleSafeguard = (key) => {
    setSafeguards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleApply = () => {
    const action = scenario.action_cards.find((c) => c.id === selectedId);
    if (!action) return;
    onApply({
      action,
      scope,
      duration,
      safeguards: Array.from(safeguards),
    });
  };

  return (
    <>
      <h2 style={styles.phaseTitle}>Karar Paneli</h2>
      <p style={styles.storyText}>
        Bütçe, insan kaynağı ve göstergeleri göz önüne alarak bir politika
        seç. Kapsam, süre ve güvencelerle orantılılık düzeyini ayarlayabilirsin.
      </p>

      <div
        style={{
          marginBottom: 10,
          padding: 10,
          borderRadius: 10,
          border: "1px solid #374151",
          background: "#020617",
          fontSize: 13,
        }}
      >
        <strong>Kaynaklar:</strong> Bütçe: {budget.toFixed(0)} 💰 | İnsan
        kaynağı: {hr.toFixed(0)} 👥
      </div>

      {affordable.length === 0 ? (
        <>
          <p style={styles.storyText}>
            Hiçbir kartı oynayacak kadar kaynağın kalmadı. Bu turu pas
            geçersen göstergeler üzerinde ciddi olumsuz etki olacak.
          </p>
          <div style={styles.actionsRow}>
            <button style={styles.primaryButton} onClick={onSkip}>
              Turu atla (riskli)
            </button>
          </div>
        </>
      ) : (
        <>
          <h3 style={styles.sideTitle}>Aksiyon Kartları</h3>
          <div style={styles.actionsGrid}>
            {scenario.action_cards.map((card) => {
              const canPlay = budget >= card.cost && hr >= card.hr_cost;
              const selected = selectedId === card.id;
              return (
                <button
                  key={card.id}
                  style={{
                    ...styles.actionCard,
                    border: selected
                      ? "2px solid #f97316"
                      : "1px solid #4b5563",
                    opacity: canPlay ? 1 : 0.4,
                    cursor: canPlay ? "pointer" : "not-allowed",
                  }}
                  onClick={() => canPlay && setSelectedId(card.id)}
                >
                  <div style={styles.actionTitle}>{card.name}</div>
                  <div style={styles.actionTooltip}>{card.tooltip}</div>
                  <div style={styles.actionCosts}>
                    💰 {card.cost} | 👥 {card.hr_cost} | ⚡{" "}
                    {card.speed.toUpperCase()}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedId && (
            <>
              <h3 style={{ ...styles.sideTitle, marginTop: 12 }}>
                Politika Ayarları
              </h3>
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid #1f2937",
                  padding: 10,
                  background: "#020617",
                  fontSize: 13,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ marginBottom: 4 }}>Kapsam</div>
                  <div style={styles.chipRow}>
                    <Chip
                      label="Hedefli"
                      active={scope === "targeted"}
                      onClick={() => setScope("targeted")}
                    />
                    <Chip
                      label="Genel"
                      active={scope === "general"}
                      onClick={() => setScope("general")}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ marginBottom: 4 }}>Süre</div>
                  <div style={styles.chipRow}>
                    <Chip
                      label="Kısa"
                      active={duration === "short"}
                      onClick={() => setDuration("short")}
                    />
                    <Chip
                      label="Orta"
                      active={duration === "medium"}
                      onClick={() => setDuration("medium")}
                    />
                    <Chip
                      label="Uzun"
                      active={duration === "long"}
                      onClick={() => setDuration("long")}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ marginBottom: 4 }}>Güvenceler</div>
                  <div style={styles.chipRow}>
                    <Chip
                      label="Şeffaflık raporu"
                      active={safeguards.has("transparency")}
                      onClick={() => toggleSafeguard("transparency")}
                    />
                    <Chip
                      label="İtiraz mekanizması"
                      active={safeguards.has("appeal")}
                      onClick={() => toggleSafeguard("appeal")}
                    />
                    <Chip
                      label="Otomatik sona erdirme"
                      active={safeguards.has("sunset")}
                      onClick={() => toggleSafeguard("sunset")}
                    />
                  </div>
                </div>
              </div>

              <div style={styles.actionsRow}>
                <button style={styles.primaryButton} onClick={handleApply}>
                  Uygula
                </button>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        border: active ? "1px solid #f97316" : "1px solid #4b5563",
        background: active ? "#0f172a" : "#020617",
        color: "#e5e7eb",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

/* ---------------------- Immediate ---------------------- */

function ImmediateScreen({
  scenario,
  results,
  metricsBefore,
  metricsAfter,
  onNext,
}) {
  const diff = (a, b) => (a - b).toFixed(1);

  const immediateText = results.skipped
    ? "Kaynak yetersizliği nedeniyle hükümet krize etkin biçimde müdahale edemedi. Krizin etkileri derinleşti ve halk arasında ciddi kaygı oluştu."
    : scenario.immediate_text.replace("{}", results.actionName || "");

  return (
    <>
      <h2 style={styles.phaseTitle}>Anında Etkiler</h2>
      <p style={styles.storyText}>{immediateText}</p>
      <div style={styles.resultGrid}>
        <ResultLine
          label="🛡️ Güvenlik"
          before={metricsBefore.security}
          after={metricsAfter.security}
          diff={diff(metricsAfter.security, metricsBefore.security)}
        />
        <ResultLine
          label="🗽 Özgürlük"
          before={metricsBefore.freedom}
          after={metricsAfter.freedom}
          diff={diff(metricsAfter.freedom, metricsBefore.freedom)}
        />
        <ResultLine
          label="🤝 Kamu Güveni"
          before={metricsBefore.public_trust}
          after={metricsAfter.public_trust}
          diff={diff(
            metricsAfter.public_trust,
            metricsBefore.public_trust
          )}
        />
        <ResultLine
          label="💪 Dayanıklılık"
          before={metricsBefore.resilience}
          after={metricsAfter.resilience}
          diff={diff(metricsAfter.resilience, metricsBefore.resilience)}
        />
        <ResultLine
          label="😩 Uyum Yorgunluğu"
          before={metricsBefore.fatigue}
          after={metricsAfter.fatigue}
          diff={diff(metricsAfter.fatigue, metricsBefore.fatigue)}
        />
      </div>
      <div style={styles.actionsRow}>
        <button style={styles.primaryButton} onClick={onNext}>
          Bir süre sonra...
        </button>
      </div>
    </>
  );
}

function ResultLine({ label, before, after, diff }) {
  return (
    <div style={styles.resultLine}>
      <span>{label}:</span>
      <span style={{ marginLeft: 6 }}>
        {before.toFixed(1)} → {after.toFixed(1)}
      </span>
      <span style={styles.diffText}>({diff})</span>
    </div>
  );
}

/* ---------------------- Delayed ---------------------- */

function DelayedScreen({ scenario, results, metrics, onNext }) {
  const delayedText = results.skipped
    ? "Eylemsizliğin uzun vadeli sonuçları ağır oldu. Toparlanma süreci yavaşladı, gelecekteki krizlere karşı ülkenin dayanıklılığı geriledi."
    : scenario.delayed_text;

  return (
    <>
      <h2 style={styles.phaseTitle}>Gecikmeli Etkiler</h2>
      <p style={styles.storyText}>{delayedText}</p>
      <p style={{ ...styles.storyText, fontSize: 13, marginTop: 10 }}>
        Gecikmeli etkiler, özellikle dayanıklılık ve uyum yorgunluğu üzerinde
        belirleyici oluyor. Uzun vadede güvenlik kazanımlarının kalıcı olması
        için kamu güveni ve özgürlüklerin çok fazla aşınmaması gerekiyor.
      </p>
      <div style={styles.actionsRow}>
        <button style={styles.primaryButton} onClick={onNext}>
          Kriz raporunu gör
        </button>
      </div>
    </>
  );
}

/* ---------------------- Report ---------------------- */

function ReportScreen({ metricsBefore, metricsAfter, results, onNext }) {
  const s = (v) => v.toFixed(1);

  return (
    <>
      <h2 style={styles.phaseTitle}>Kriz Sonu Raporu</h2>
      <div
        style={{
          borderRadius: 10,
          border: "1px solid #374151",
          padding: 10,
          background: "#020617",
          marginBottom: 10,
        }}
      >
        <h3 style={{ marginTop: 0, fontSize: 16 }}>Metrik Özeti</h3>
        <table style={{ width: "100%", fontSize: 13, borderSpacing: 0 }}>
          <thead>
            <tr>
              <th align="left">Gösterge</th>
              <th align="right">Başlangıç</th>
              <th align="right">Son</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Güvenlik", "security"],
              ["Özgürlük", "freedom"],
              ["Kamu Güveni", "public_trust"],
              ["Dayanıklılık", "resilience"],
              ["Uyum Yorgunluğu", "fatigue"],
            ].map(([label, key]) => (
              <tr key={key}>
                <td>{label}</td>
                <td align="right">{s(metricsBefore[key])}</td>
                <td align="right">{s(metricsAfter[key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          borderRadius: 10,
          border: "1px solid #374151",
          padding: 10,
          background: "#020617",
          marginBottom: 10,
        }}
      >
        <h3 style={{ marginTop: 0, fontSize: 16 }}>Karşı-olgu Analizi</h3>
        <p style={styles.storyText}>
          <i>{results.counter_factual}</i>
        </p>
        {results.safeguards && (
          <p style={{ ...styles.storyText, fontSize: 13 }}>
            Seçtiğiniz{" "}
            <strong>{results.safeguards.length} güvence</strong>, özgürlük
            kaybını ve kamu güveni üzerindeki olumsuz etkiyi yumuşattı.
          </p>
        )}
      </div>

      <div style={styles.actionsRow}>
        <button style={styles.primaryButton} onClick={onNext}>
          Sonraki krize geç
        </button>
      </div>
    </>
  );
}

/* ---------------------- End Screen + Grafik ---------------------- */

function EndScreen({ metrics, budget, hr, history, onRestart }) {
  const security = metrics.security;
  const freedom = metrics.freedom;
  const trust = metrics.public_trust;

  const leadershipScore = ((security + freedom + trust) / 3).toFixed(1);

  let styleLabel = "Dengeli Stratejist";
  let styleDesc =
    "Güvenlik, özgürlük ve kamu güvenini birlikte gözetmeye çalıştın.";

  if (security > 75 && freedom < 50) {
    styleLabel = "Güvenlik Odaklı Taktisyen";
    styleDesc =
      "Kriz anlarında güvenliği önceledin; bu da özgürlükler ve meşruiyet üzerinde baskı yarattı.";
  } else if (freedom > 75 && security < 50) {
    styleLabel = "Özgürlük Savunucusu";
    styleDesc =
      "Hak ve özgürlükleri korumaya odaklandın; bazı anlarda güvenlikten ödün verdin.";
  } else if (trust > 70 && metrics.resilience > 60) {
    styleLabel = "Toplum İnşa Eden Lider";
    styleDesc =
      "Kamu güveni ve dayanıklılığı artıran kararlar aldın; bu, uzun vadede demokratik istikrarı destekler.";
  }

  const timelineData = useMemo(() => {
    const data = history.map((m, idx) => ({
      step: idx === 0 ? "Başlangıç" : `Kriz ${idx}`,
      security: m.security,
      freedom: m.freedom,
      trust: m.public_trust,
    }));
    data.push({
      step: "Son",
      security: metrics.security,
      freedom: metrics.freedom,
      trust: metrics.public_trust,
    });
    return data;
  }, [history, metrics.security, metrics.freedom, metrics.public_trust]);

  return (
    <div style={styles.endMain}>
      <h2 style={styles.phaseTitle}>Oyun Sonu</h2>
      <p style={styles.storyText}>
        Liderlik Skoru: <strong>{leadershipScore} / 100</strong>
      </p>
      <p style={styles.storyText}>
        Liderlik Tarzı: <strong>{styleLabel}</strong>
      </p>
      <p style={styles.storyText}>{styleDesc}</p>

      <div style={styles.resultGrid}>
        <div style={styles.resultLine}>🛡️ Güvenlik: {security.toFixed(1)}</div>
        <div style={styles.resultLine}>🗽 Özgürlük: {freedom.toFixed(1)}</div>
        <div style={styles.resultLine}>
          🤝 Kamu Güveni: {trust.toFixed(1)}
        </div>
        <div style={styles.resultLine}>
          💪 Dayanıklılık: {metrics.resilience.toFixed(1)}</div>
        <div style={styles.resultLine}>
          😩 Uyum Yorgunluğu: {metrics.fatigue.toFixed(1)}</div>
        <div style={styles.resultLine}>💰 Bütçe: {budget.toFixed(0)}</div>
        <div style={styles.resultLine}>👥 İnsan Kaynağı: {hr.toFixed(0)}</div>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: 10,
          borderRadius: 10,
          border: "1px solid #1f2937",
          background: "#020617",
        }}
      >
        <h3
          style={{
            margin: 0,
            marginBottom: 6,
            fontSize: 14,
            color: "#a5b4fc",
          }}
        >
          Zaman İçinde Güvenlik / Özgürlük / Güven
        </h3>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={timelineData}>
              <XAxis dataKey="step" fontSize={11} />
              <YAxis domain={[0, 100]} fontSize={11} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="security"
                name="Güvenlik"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="freedom"
                name="Özgürlük"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="trust"
                name="Kamu Güveni"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p style={{ ...styles.storyText, fontSize: 12, marginTop: 8 }}>
        Çizgi, her krizin başında ve sonunda güvenlik, özgürlük ve kamu
        güveninin nasıl değiştiğini gösterir. Farklı oyunlarda bu deseni
        karşılaştırarak liderlik tarzını tartışabilirsiniz.
      </p>

      <div style={styles.actionsRow}>
        <button style={styles.primaryButton} onClick={onRestart}>
          Yeni oyun başlat
        </button>
      </div>
    </div>
  );
}

/* ---------------------- Panel ve News ---------------------- */

function NewsTicker({ news, compact = false }) {
  return (
    <div style={compact ? styles.newsCompact : styles.newsBox}>
      <div style={{ fontSize: 12, color: "#a5b4fc", marginBottom: 4 }}>
        Haber Akışı
      </div>
      {news.map((n, i) => (
        <div key={i} style={{ fontSize: 12, marginBottom: 2 }}>
          • {n}
        </div>
      ))}
    </div>
  );
}

function MetricsPanel({ metrics, budget, hr }) {
  const rows = [
    ["💰 Bütçe", budget, 100],
    ["👥 İnsan Kaynağı", hr, 50],
    ["🛡️ Güvenlik", metrics.security, 100],
    ["🗽 Özgürlük", metrics.freedom, 100],
    ["🤝 Kamu Güveni", metrics.public_trust, 100],
    ["💪 Dayanıklılık", metrics.resilience, 100],
    ["😩 Uyum Yorgunluğu", metrics.fatigue, 100],
  ];
  return (
    <div style={{ marginTop: 10 }}>
      <h3 style={styles.sideTitle}>Gösterge Paneli</h3>
      {rows.map(([label, value, max]) => {
        const ratio = clamp(value / max, 0, 1);
        return (
          <div key={label} style={{ marginBottom: 6 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
              }}
            >
              <span>{label}</span>
              <span>{value.toFixed(1)}</span>
            </div>
            <div style={styles.metricBarTrack}>
              <div
                style={{
                  ...styles.metricBarFill,
                  width: `${ratio * 100}%`,
                }}
              />
            </div>
          </div>
        );
      })}
      <p style={{ ...styles.storyText, fontSize: 11, marginTop: 6 }}>
        Uyum yorgunluğu 50’yi geçtiğinde meşruiyet krizi riski artar. Güvenlik
        kazanımlarını korumak için kamu güveni ve özgürlükleri de gözetmek
        gerekir.
      </p>
    </div>
  );
}

function TutorialMetricBar({ label, value }) {
  const safe = typeof value === "number" ? clamp(value, 0, 100) : 0;
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "#e5e7eb",
        }}
      >
        <span>{label}</span>
        <span>{safe.toFixed(1)}</span>
      </div>
      <div style={styles.metricBarTrack}>
        <div
          style={{
            ...styles.metricBarFill,
            width: `${safe}%`,
          }}
        />
      </div>
    </div>
  );
}

/* ---------------------- STYLES ---------------------- */

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    height: "100%",
  },
  header: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #1f2937",
    background:
      "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(56,189,248,0.06))",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  headerIcon: { fontSize: 26 },
  headerTitle: { fontSize: 20, fontWeight: 600 },
  headerSubtitle: { fontSize: 13, color: "#9ca3af" },
  headerBadge: {
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid #38bdf8",
    color: "#e0f2fe",
    backgroundColor: "rgba(8,47,73,0.7)",
  },
  mainRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 2.2fr) minmax(0, 1.1fr)",
    gap: 12,
    minHeight: 380,
  },
  mainCard: {
    borderRadius: 12,
    border: "1px solid #1f2937",
    padding: 16,
    background:
      "radial-gradient(circle at top left,#020617,#020617 40%,#0b1120 100%)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  sideCard: {
    borderRadius: 12,
    border: "1px solid #1f2937",
    padding: 14,
    background: "#020617",
  },
  sideTitle: {
    margin: "0 0 8px 0",
    fontSize: 16,
    color: "#a5b4fc",
  },
  phaseTitle: {
    margin: 0,
    marginBottom: 8,
    fontSize: 19,
    color: "#a5b4fc",
  },
  storyText: {
    fontSize: 14,
    color: "#e5e7eb",
    lineHeight: 1.5,
    whiteSpace: "pre-line",
  },
  advisorsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
    marginTop: 8,
  },
  advisorCard: {
    borderRadius: 10,
    border: "1px solid #374151",
    padding: 10,
    background: "#020617",
  },
  advisorName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#38bdf8",
    marginBottom: 4,
  },
  advisorText: {
    fontSize: 13,
    color: "#e5e7eb",
  },
  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
    marginTop: 10,
  },
  actionCard: {
    borderRadius: 10,
    border: "1px solid #4b5563",
    padding: 10,
    background: "#020617",
    textAlign: "left",
    transition:
      "transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s",
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "#f472b6",
    marginBottom: 4,
  },
  actionTooltip: { fontSize: 13, color: "#e5e7eb", marginBottom: 8 },
  actionCosts: { fontSize: 12, color: "#9ca3af" },
  resultGrid: {
    marginTop: 10,
    display: "grid",
    gap: 6,
  },
  resultLine: {
    fontSize: 14,
    color: "#e5e7eb",
    display: "flex",
    alignItems: "baseline",
    gap: 4,
  },
  diffText: {
    color: "#60a5fa",
    fontSize: 13,
  },
  actionsRow: {
    marginTop: 14,
    display: "flex",
    justifyContent: "center",
  },
  primaryButton: {
    padding: "10px 20px",
    borderRadius: 999,
    background: "linear-gradient(to right, #22c55e, #14b8a6)",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    color: "#020617",
    fontSize: 14,
  },
  endMain: {
    borderRadius: 12,
    border: "1px solid #1f2937",
    padding: 16,
    background: "#020617",
  },
  newsBox: {
    borderRadius: 8,
    border: "1px solid #1f2937",
    padding: 8,
    background: "#020617",
    marginBottom: 8,
    maxHeight: 140,
    overflowY: "auto",
  },
  newsCompact: {
    borderRadius: 8,
    border: "1px solid #1f2937",
    padding: 6,
    background: "#020617",
    maxHeight: 100,
    overflowY: "auto",
  },
  metricBarTrack: {
    width: "100%",
    height: 6,
    borderRadius: 999,
    backgroundColor: "#0f172a",
    overflow: "hidden",
  },
  metricBarFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(to right,#22c55e,#a3e635)",
    transition: "width 0.2s ease-out",
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
};
