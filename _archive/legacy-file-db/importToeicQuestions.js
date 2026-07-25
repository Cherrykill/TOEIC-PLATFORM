require('dotenv').config();
const mongoose = require('mongoose');
const ToeicQuestion = require('../models/ToeicQuestion');
const sampleQuestions = require('../data/toeicSampleQuestions.json');

const importQuestions = async () => {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('🗑️  Clearing existing TOEIC questions...');
        await ToeicQuestion.deleteMany({});
        console.log('✅ Cleared existing questions');

        console.log('📝 Importing sample questions...');

        const allQuestions = [];

        // Import Part 1 questions
        if (sampleQuestions.part1) {
            allQuestions.push(...sampleQuestions.part1);
        }

        // Import Part 2 questions
        if (sampleQuestions.part2) {
            allQuestions.push(...sampleQuestions.part2);
        }

        // Import Part 3 questions
        if (sampleQuestions.part3) {
            allQuestions.push(...sampleQuestions.part3);
        }

        // Import Part 4 questions
        if (sampleQuestions.part4) {
            allQuestions.push(...sampleQuestions.part4);
        }

        // Import Part 5 questions
        if (sampleQuestions.part5) {
            allQuestions.push(...sampleQuestions.part5);
        }

        // Import Part 6 questions
        if (sampleQuestions.part6) {
            allQuestions.push(...sampleQuestions.part6);
        }

        // Import Part 7 questions
        if (sampleQuestions.part7) {
            allQuestions.push(...sampleQuestions.part7);
        }

        const created = await ToeicQuestion.insertMany(allQuestions);
        console.log(`✅ Imported ${created.length} questions successfully`);

        // Show summary
        const summary = await ToeicQuestion.aggregate([
            {
                $group: {
                    _id: '$part',
                    count: { $sum: 1 },
                    difficulties: { $push: '$difficulty' },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        console.log('\n📊 Import Summary:');
        console.log('='.repeat(50));
        summary.forEach(item => {
            console.log(`Part ${item._id}: ${item.count} questions`);
        });
        console.log('='.repeat(50));

        console.log('\n✨ Import completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error importing questions:', error);
        process.exit(1);
    }
};

// Run import
importQuestions();
