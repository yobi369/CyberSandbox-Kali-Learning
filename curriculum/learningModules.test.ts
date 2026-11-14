import { describe, expect, it } from 'vitest';
import { getLearningModule, LEARNING_MODULES, validateLearningModule } from './learningModules';

describe('deep learning curriculum', () => {
  it('provides a substantial module for every existing core lab', () => {
    expect(LEARNING_MODULES.map((module) => module.labId).sort()).toEqual([
      'deep-recon-full-chain',
      'defensive-web-observation',
      'linux-foundations'
    ]);
    for (const module of LEARNING_MODULES) {
      expect(module.lessons.length).toBeGreaterThanOrEqual(4);
      expect(module.capstoneProject.estimatedHours).toBeGreaterThanOrEqual(4);
      expect(module.capstoneProject.caseMaterials).toHaveLength(3);
      expect(module.capstoneProject.caseMaterials.every((material) => material.content.length >= 100)).toBe(true);
      expect(module.capstoneProject.rubric.reduce((sum, criterion) => sum + criterion.weight, 0)).toBe(100);
      expect(validateLearningModule(module)).toEqual([]);
    }
  });

  it('includes the full learning cycle in every lesson', () => {
    for (const module of LEARNING_MODULES) {
      for (const lesson of module.lessons) {
        expect(lesson.prerequisites.length).toBeGreaterThan(0);
        expect(lesson.concepts.length).toBeGreaterThanOrEqual(3);
        expect(lesson.commandAnatomy.length).toBeGreaterThan(0);
        expect(lesson.workedExample.interpretation.length).toBeGreaterThanOrEqual(2);
        expect(lesson.workedExample.notEstablished.length).toBeGreaterThanOrEqual(2);
        expect(lesson.evidencePractice.length).toBeGreaterThan(0);
        expect(lesson.commonMistakes.length).toBeGreaterThanOrEqual(2);
        expect(lesson.defensiveRelevance.length).toBeGreaterThanOrEqual(2);
        expect(lesson.guidedPractice.length).toBeGreaterThanOrEqual(2);
        expect(lesson.independentChallenge.deliverables.length).toBeGreaterThanOrEqual(2);
        expect(lesson.knowledgeCheck.length).toBeGreaterThanOrEqual(2);
        expect(lesson.references.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('does not describe seeded browser output as live execution', () => {
    for (const module of LEARNING_MODULES) {
      expect(module.overview.toLowerCase()).toMatch(/simulat|seeded|fictional/);
      for (const lesson of module.lessons) {
        expect(lesson.workedExample.notEstablished.join(' ').toLowerCase()).toMatch(/simulat|fictional|does not|not prove|not establish|cannot|no packets/);
        for (const command of lesson.commandAnatomy) {
          expect(command.safety.length).toBeGreaterThan(20);
        }
      }
    }
  });

  it('resolves modules by the existing lab identifier', () => {
    expect(getLearningModule('linux-foundations')?.lessons).toHaveLength(4);
    expect(getLearningModule('not-a-real-lab')).toBeUndefined();
  });

  it('adds an advanced applied lesson and substantive capstone to each core topic', () => {
    for (const module of LEARNING_MODULES) {
      expect(module.lessons.some((lesson) => lesson.level === 'Advanced' && lesson.estimatedMinutes >= 60)).toBe(true);
      expect(module.capstoneProject.milestones).toHaveLength(4);
      expect(module.capstoneProject.deliverables.length).toBeGreaterThanOrEqual(5);
      expect(module.capstoneProject.reflectionPrompts.length).toBeGreaterThanOrEqual(3);
      expect(module.educatorReviewStatus).toBe('requires-institution-review');
    }
  });
});
