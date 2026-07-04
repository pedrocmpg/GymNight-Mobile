import User from '../models/User';
import Exercise from '../models/Exercise';
import Workout from '../models/Workout';
import WorkoutExercise from '../models/WorkoutExercise';
import WorkoutSession from '../models/WorkoutSession';
import LoggedSet from '../models/LoggedSet';

describe('WatermelonDB Model Classes', () => {
  describe('User', () => {
    it('should have the correct table name', () => {
      expect(User.table).toBe('users');
    });
  });

  describe('Exercise', () => {
    it('should have the correct table name', () => {
      expect(Exercise.table).toBe('exercises');
    });

    it('should define has_many associations', () => {
      expect(Exercise.associations).toBeDefined();
      expect(Exercise.associations.workout_exercises).toEqual({
        type: 'has_many',
        foreignKey: 'exercise_id',
      });
      expect(Exercise.associations.logged_sets).toEqual({
        type: 'has_many',
        foreignKey: 'exercise_id',
      });
    });
  });

  describe('Workout', () => {
    it('should have the correct table name', () => {
      expect(Workout.table).toBe('workouts');
    });

    it('should define belongs_to and has_many associations', () => {
      expect(Workout.associations).toBeDefined();
      expect(Workout.associations.users).toEqual({
        type: 'belongs_to',
        key: 'user_id',
      });
      expect(Workout.associations.workout_exercises).toEqual({
        type: 'has_many',
        foreignKey: 'workout_id',
      });
      expect(Workout.associations.workout_sessions).toEqual({
        type: 'has_many',
        foreignKey: 'workout_id',
      });
    });
  });

  describe('WorkoutExercise', () => {
    it('should have the correct table name', () => {
      expect(WorkoutExercise.table).toBe('workout_exercises');
    });

    it('should define belongs_to associations', () => {
      expect(WorkoutExercise.associations).toBeDefined();
      expect(WorkoutExercise.associations.workouts).toEqual({
        type: 'belongs_to',
        key: 'workout_id',
      });
      expect(WorkoutExercise.associations.exercises).toEqual({
        type: 'belongs_to',
        key: 'exercise_id',
      });
    });
  });

  describe('WorkoutSession', () => {
    it('should have the correct table name', () => {
      expect(WorkoutSession.table).toBe('workout_sessions');
    });

    it('should define belongs_to and has_many associations', () => {
      expect(WorkoutSession.associations).toBeDefined();
      expect(WorkoutSession.associations.workouts).toEqual({
        type: 'belongs_to',
        key: 'workout_id',
      });
      expect(WorkoutSession.associations.logged_sets).toEqual({
        type: 'has_many',
        foreignKey: 'session_id',
      });
    });
  });

  describe('LoggedSet', () => {
    it('should have the correct table name', () => {
      expect(LoggedSet.table).toBe('logged_sets');
    });

    it('should define belongs_to associations', () => {
      expect(LoggedSet.associations).toBeDefined();
      expect(LoggedSet.associations.workout_sessions).toEqual({
        type: 'belongs_to',
        key: 'session_id',
      });
      expect(LoggedSet.associations.exercises).toEqual({
        type: 'belongs_to',
        key: 'exercise_id',
      });
    });
  });
});
