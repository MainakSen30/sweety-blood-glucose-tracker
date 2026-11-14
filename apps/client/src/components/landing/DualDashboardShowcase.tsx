import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { BrandMark, PersonIcon, StethoscopeIcon } from '../ui/icons.js';
import { DoctorPreview, PatientPreview } from './DashboardPreviews.js';

const HOUSE_EASE = [0.23, 1, 0.32, 1] as const;
const SCROLL_RANGE = [0, 0.22, 0.42, 0.78, 1];
// The stacked phone cards are tall, so their fade has to finish almost as soon
// as the section enters; otherwise the first preview sits half-faded in view.
const MOBILE_RANGE = [0, 0.06, 0.42, 0.78, 1];

/**
 * The two previews open like a case file: 60° between their planes at rest,
 * each starting 58° away on scroll entry. Below desktop the turn drops to a
 * hint, and on phones both cards stack upright so nothing becomes unreadable.
 * Only transform and opacity are animated.
 */
export function DualDashboardShowcase() {
  const stageRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isTablet = useMediaQuery('(min-width: 640px)');

  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ['start end', 'end start'],
  });

  const entryX = isDesktop ? 120 : isTablet ? 36 : 0;
  const entryTurn = isDesktop ? 58 : isTablet ? 24 : 0;
  const restTurn = isDesktop ? 30 : isTablet ? 10 : 0;
  const lean = isDesktop ? 1.5 : 0;

  const leftX = useTransform(scrollYProgress, SCROLL_RANGE, [-entryX, 0, 0, -6, -16]);
  const rightX = useTransform(scrollYProgress, SCROLL_RANGE, [entryX, 0, 0, 6, 16]);
  const leftTurn = useTransform(scrollYProgress, SCROLL_RANGE, [
    -entryTurn,
    -restTurn,
    -restTurn,
    -restTurn - 2,
    -restTurn - 6,
  ]);
  const rightTurn = useTransform(scrollYProgress, SCROLL_RANGE, [
    entryTurn,
    restTurn,
    restTurn,
    restTurn + 2,
    restTurn + 6,
  ]);
  const leftLean = useTransform(scrollYProgress, SCROLL_RANGE, [-lean * 2, lean, lean, lean, lean]);
  const rightLean = useTransform(scrollYProgress, SCROLL_RANGE, [
    lean * 2,
    -lean,
    -lean,
    -lean,
    -lean,
  ]);
  const scale = useTransform(
    scrollYProgress,
    SCROLL_RANGE,
    isTablet ? [0.94, 1, 1, 1, 0.985] : [1, 1, 1, 1, 1],
  );
  const opacity = useTransform(
    scrollYProgress,
    isTablet ? SCROLL_RANGE : MOBILE_RANGE,
    isTablet ? [0.3, 0.72, 1, 1, 0.94] : [0.55, 1, 1, 1, 1],
  );
  const y = useTransform(scrollYProgress, SCROLL_RANGE, [0, 0, 0, 4, 14]);

  // Reduced motion keeps the finished composition, just without the movement.
  const leftStyle = reduceMotion
    ? { rotateY: -restTurn, rotateZ: lean }
    : { x: leftX, y, rotateY: leftTurn, rotateZ: leftLean, scale, opacity };
  const rightStyle = reduceMotion
    ? { rotateY: restTurn, rotateZ: -lean }
    : { x: rightX, y, rotateY: rightTurn, rotateZ: rightLean, scale, opacity };

  return (
    <section
      id="experiences"
      aria-labelledby="experiences-heading"
      className="relative overflow-x-clip border-t border-line bg-cream scroll-mt-6"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-olive">Two experiences, one record</p>
          <h2
            id="experiences-heading"
            className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
          >
            One record, seen from both sides
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink-soft">
            Patients log four readings a day. Doctors see the same record read-only, and only after
            a patient accepts their invitation.
          </p>
        </div>

        <div className="mt-8 flex items-center gap-3 text-xs text-ink-soft">
          <span aria-hidden="true" className="h-px flex-1 bg-line" />
          <BrandMark className="size-4 shrink-0" />
          <span className="shrink-0">Access starts with a patient's invitation</span>
          <span aria-hidden="true" className="h-px flex-1 bg-line" />
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 sm:gap-6">
          <motion.div
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: reduceMotion ? 0 : 0.3, ease: HOUSE_EASE }}
          >
            <h3 className="flex items-center gap-2 text-sm font-medium text-olive-dark">
              <PersonIcon className="size-4" />
              Patient experience
            </h3>
            <p className="mt-1 text-lg tracking-tight text-ink">
              Take control of your glucose journey
            </p>
          </motion.div>

          <motion.div
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: reduceMotion ? 0 : 0.3, ease: HOUSE_EASE, delay: 0.06 }}
          >
            <h3 className="flex items-center gap-2 text-sm font-medium text-olive-dark">
              <StethoscopeIcon className="size-4" />
              Doctor experience
            </h3>
            <p className="mt-1 text-lg tracking-tight text-ink">
              Stay connected to the patients you care for
            </p>
          </motion.div>
        </div>

        <div ref={stageRef} className="relative mt-5">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-4 -top-4 bottom-4 opacity-60 [background-image:linear-gradient(to_right,var(--color-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-line)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_72%)]"
          />

          <div className="relative grid gap-10 sm:grid-cols-2 sm:gap-6 lg:[perspective:2000px]">
            <motion.div data-preview="patient" style={leftStyle}>
              <PatientPreview />
            </motion.div>
            <motion.div data-preview="doctor" style={rightStyle}>
              <DoctorPreview />
            </motion.div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-ink-soft">
          Illustrative previews. Names and readings are examples.
        </p>
      </div>
    </section>
  );
}
