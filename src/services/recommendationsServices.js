import { TOP_JOBS_LIMIT, LEARNING_PATH_LIMIT, MATH_SCORE_THRESHOLD } from "../utils/constants.js";

const LEARNING_RESOURCES = {
     // Programming & Framework
    react:       [{ title: 'React Official Docs',      url: 'https://react.dev',                      type: 'docs'   },
                    { title: 'React - The Complete Guide', url: 'https://www.udemy.com/course/react-the-complete-guide-incl-redux', type: 'course' },
                    { title: 'Full Stack Open (React)',   url: 'https://fullstackopen.com',              type: 'free'   }],
    nodejs:      [{ title: 'Node.js Official Docs',    url: 'https://nodejs.org/en/docs',             type: 'docs'   },
                    { title: 'The Odin Project (Node)',   url: 'https://www.theodinproject.com',         type: 'free'   },
                    { title: 'Node.js Design Patterns',   url: 'https://nodejsdesignpatterns.com',       type: 'book'   }],
    python:      [{ title: 'Python Official Docs',     url: 'https://docs.python.org/3',              type: 'docs'   },
                    { title: 'Automate the Boring Stuff', url: 'https://automatetheboringstuff.com',     type: 'free'   },
                    { title: 'Python for Everybody',      url: 'https://www.coursera.org/specializations/python', type: 'course' }],
    tensorflow:  [{ title: 'TensorFlow Official Docs', url: 'https://www.tensorflow.org/learn',       type: 'docs'   },
                    { title: 'Deep Learning Specialization', url: 'https://www.deeplearning.ai',         type: 'course' },
                    { title: 'Hands-On ML with Scikit-Learn', url: 'https://www.oreilly.com/library/view/hands-on-machine-learning', type: 'book' }],
    // Data & DB
    postgresql:  [{ title: 'PostgreSQL Tutorial',       url: 'https://www.postgresqltutorial.com',    type: 'free'   },
                    { title: 'Learn PostgreSQL (freeCodeCamp)', url: 'https://www.youtube.com/watch?v=qw--VYLpxG4', type: 'free' },
                    { title: 'Designing Data-Intensive Apps', url: 'https://dataintensive.net',          type: 'book'   }],
    pandas:      [{ title: 'Pandas Documentation',      url: 'https://pandas.pydata.org/docs',        type: 'docs'   },
                    { title: 'Kaggle Pandas Course',       url: 'https://www.kaggle.com/learn/pandas',  type: 'free'   },
                    { title: 'Python Data Science Handbook', url: 'https://jakevdp.github.io/PythonDataScienceHandbook', type: 'free' }],
    // DevOps & Tools
    docker:      [{ title: 'Docker Official Docs',      url: 'https://docs.docker.com',               type: 'docs'   },
                    { title: 'Docker & Kubernetes (Udemy)', url: 'https://www.udemy.com/course/docker-kubernetes-the-practical-guide', type: 'course' },
                    { title: 'Play with Docker',           url: 'https://labs.play-with-docker.com',    type: 'free'   }],
    git:         [{ title: 'Pro Git Book',               url: 'https://git-scm.com/book',             type: 'free'   },
                    { title: 'GitHub Skills',               url: 'https://skills.github.com',            type: 'free'   },
                    { title: 'Learn Git Branching',         url: 'https://learngitbranching.js.org',     type: 'free'   }],
    // Soft skills & Management
    communication: [{ title: 'Coursera: Communication Skills', url: 'https://www.coursera.org/courses?query=communication', type: 'course' }],
    leadership:    [{ title: 'MindTools: Leadership',    url: 'https://www.mindtools.com/leadership',  type: 'free'   }],

}

const buildDefaultResource = (skillName) => ([
  { title: `Cari "${skillName}" di Coursera`,  url: `https://www.coursera.org/search?query=${encodeURIComponent(skillName)}`, type: 'course' },
  { title: `Cari "${skillName}" di YouTube`,   url: `https://www.youtube.com/results?search_query=${encodeURIComponent(skillName)}+tutorial`, type: 'free' },
  { title: `Dokumentasi resmi ${skillName}`,   url: `https://www.google.com/search?q=${encodeURIComponent(skillName)}+official+docs`, type: 'docs' },
])


const buildLearningPath = (missingSkillIds, allJobSkills) => {
    return missingSkillIds.slice(0, 10).map(skillId => {
        const skill = allJobSkills.find(s => s.skillId === skillId)
        const skillName = skill?.skillName || skillId

        const key       = skillId.toLowerCase().replace(/[^a-z0-9]/g, '')
        const resources = (LEARNING_RESOURCES[key] || buildDefaultResource(skillName))
          .slice(0, LEARNING_PATH_LIMIT)
        return {
            skillId,
            skillName,
            resources
        }
    })
}

const getTopRecommendations = (matchHistory) => {
    return matchHistory.filter(m => m.matchScore >= MATH_SCORE_THRESHOLD).sort((a, b) => b.matchScore - a.matchScore).slice(0, TOP_JOBS_LIMIT).map(m => ({
         matchResultId: m.id,
        matchScore:    m.matchScore,
        jobId:         m.jobPosting.id,
        jobTitle:      m.jobPosting.title,
        company:       m.jobPosting.company?.companyName || null,
        location:      m.jobPosting.location             || null,
        workType:      m.jobPosting.formattedWorkType     || null,
        level:         m.jobPosting.formattedExperienceLevel || null,
        remote:        m.jobPosting.remoteAllowed > 0,
        salaryRange:   m.jobPosting.salaries?.[0]
            ? {
                min:      m.jobPosting.salaries[0].minSalary,
                max:      m.jobPosting.salaries[0].maxSalary,
                currency: m.jobPosting.salaries[0].currency,
                period:   m.jobPosting.salaries[0].payPeriod,
            }
            : null,
    }))
}

const buildRadarChartData = (skillGapjson, allJobSkills) => {
    if (!skillGapjson || !allJobSkills?.length) return []
    
    const presentSet = new Set(skillGapjson.present || [])

    return allJobSkills.map(s => ({
            skill:         s.skillName,
            skillId:       s.skillId,
            userLevel:     presentSet.has(s.skillId) ? 1 : 0,
            requiredLevel: 1,
    }))
}

const calcCareerReadiness = (matchScore, skillGapjson) => {
    if(!skillGapjson) return Math.round(matchScore * 100)
    
    const total = skillGapjson.required?.length || 0
    const present = skillGapjson.present?.length  || 0
    const ratio   = total > 0 ? present / total : matchScore
    
    const combined = (matchScore * 0.6) + (ratio * 0.4)
    return Math.round(combined * 100)
}

export default {
    getTopRecommendations,
    buildLearningPath,
    buildRadarChartData,
    calcCareerReadiness
}