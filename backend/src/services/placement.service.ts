import { prisma } from '../config/database.js';
import { notFound, badRequest } from '../utils/errors.js';

export interface UpsertProfileInput {
  fullName: string;
  rollNumber?: string;
  phone?: string;
  branch?: string;
  cgpa: number;
  tenthPercentage?: number;
  twelfthPercentage?: number;
  activeBacklogs?: number;
  graduationYear?: number;
  skills?: string[];
  resumeUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
}

export interface CreateDriveInput {
  companyName: string;
  role: string;
  description?: string;
  driveType?: 'ON_CAMPUS' | 'OFF_CAMPUS';
  eligibilityCgpa?: number;
  eligibleBranches?: string[];
  maxBacklogs?: number;
  minTenthPercent?: number;
  minTwelfthPercent?: number;
  batchYear?: number;
  ctcLpa?: number;
  location?: string;
  deadline: string | Date;
  driveDate?: string | Date;
  status?: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  selectionProcess?: string[];
}

export class PlacementService {
  /**
   * Get placement profile for a user
   */
  async getProfile(userId: string) {
    const profile = await prisma.placementProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
    return profile;
  }

  /**
   * Create or update placement profile (POD registration)
   */
  async upsertProfile(userId: string, input: UpsertProfileInput) {
    const data = {
      fullName: input.fullName,
      rollNumber: input.rollNumber || null,
      phone: input.phone || null,
      branch: input.branch || null,
      cgpa: Number(input.cgpa) || 0,
      tenthPercentage: input.tenthPercentage !== undefined && input.tenthPercentage !== null ? Number(input.tenthPercentage) : null,
      twelfthPercentage: input.twelfthPercentage !== undefined && input.twelfthPercentage !== null ? Number(input.twelfthPercentage) : null,
      activeBacklogs: input.activeBacklogs !== undefined && input.activeBacklogs !== null ? Number(input.activeBacklogs) : 0,
      graduationYear: input.graduationYear !== undefined && input.graduationYear !== null ? Number(input.graduationYear) : null,
      skills: input.skills || [],
      resumeUrl: input.resumeUrl || null,
      githubUrl: input.githubUrl || null,
      linkedinUrl: input.linkedinUrl || null,
      isVerified: true,
    };

    const profile = await prisma.placementProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...data,
      },
      update: data,
    });

    return profile;
  }

  /**
   * List placement drives with student eligibility & application status
   */
  async getDrives(
    userId: string,
    userRole: string,
    filters?: { type?: string; status?: string; search?: string; onlyEligible?: boolean }
  ) {
    const where: any = {};
    if (filters?.type && filters.type !== 'ALL') {
      where.driveType = filters.type;
    }
    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }
    if (filters?.search) {
      where.OR = [
        { companyName: { contains: filters.search } },
        { role: { contains: filters.search } },
        { location: { contains: filters.search } },
      ];
    }

    const drives = await prisma.placementDrive.findMany({
      where,
      orderBy: { deadline: 'asc' },
      include: {
        createdBy: {
          select: { id: true, fullName: true, username: true, email: true },
        },
        applications: {
          select: { id: true },
        },
      },
    });

    // If student, check eligibility and application status for each drive
    if (userRole === 'STUDENT') {
      const studentProfile = await prisma.placementProfile.findUnique({
        where: { userId },
      });

      const studentApplications = await prisma.placementApplication.findMany({
        where: { studentId: userId },
      });

      const appMap = new Map(studentApplications.map((app) => [app.driveId, app]));

      let evaluatedDrives = drives.map((drive: any) => {
        const application = appMap.get(drive.id) || null;
        let isEligible = true;
        const reasons: string[] = [];

        if (!studentProfile) {
          isEligible = false;
          reasons.push('Please complete placement registration profile');
        } else {
          if (drive.eligibilityCgpa > 0 && studentProfile.cgpa < drive.eligibilityCgpa) {
            isEligible = false;
            reasons.push(`Minimum CGPA: ${drive.eligibilityCgpa} (Your CGPA: ${studentProfile.cgpa})`);
          }

          const eligibleBranches = Array.isArray(drive.eligibleBranches)
            ? (drive.eligibleBranches as string[])
            : [];
          if (
            eligibleBranches.length > 0 &&
            (!studentProfile.branch || !eligibleBranches.includes(studentProfile.branch))
          ) {
            isEligible = false;
            reasons.push(`Eligible branches: ${eligibleBranches.join(', ')} (Your branch: ${studentProfile.branch || 'None'})`);
          }

          if (drive.maxBacklogs !== undefined && drive.maxBacklogs !== null && studentProfile.activeBacklogs > drive.maxBacklogs) {
            isEligible = false;
            reasons.push(`Max ${drive.maxBacklogs} active backlogs allowed (You have ${studentProfile.activeBacklogs})`);
          }

          if (drive.minTenthPercent && studentProfile.tenthPercentage && studentProfile.tenthPercentage < drive.minTenthPercent) {
            isEligible = false;
            reasons.push(`Minimum 10th marks: ${drive.minTenthPercent}% (You have ${studentProfile.tenthPercentage}%)`);
          }

          if (drive.minTwelfthPercent && studentProfile.twelfthPercentage && studentProfile.twelfthPercentage < drive.minTwelfthPercent) {
            isEligible = false;
            reasons.push(`Minimum 12th marks: ${drive.minTwelfthPercent}% (You have ${studentProfile.twelfthPercentage}%)`);
          }

          if (drive.batchYear && studentProfile.graduationYear && studentProfile.graduationYear !== drive.batchYear) {
            isEligible = false;
            reasons.push(`Eligible Batch: ${drive.batchYear} (Your batch: ${studentProfile.graduationYear})`);
          }
        }

        const isExpired = new Date(drive.deadline) < new Date();

        return {
          ...drive,
          applicantCount: drive.applications.length,
          hasApplied: !!application,
          applicationStatus: application ? application.status : null,
          appliedAt: application ? application.appliedAt : null,
          isEligible,
          eligibilityReason: reasons.join('; '),
          isExpired,
        };
      });

      if (filters?.onlyEligible) {
        evaluatedDrives = evaluatedDrives.filter((d) => d.isEligible);
      }

      return evaluatedDrives;
    }

    return drives.map((drive: any) => ({
      ...drive,
      applicantCount: drive.applications.length,
      isExpired: new Date(drive.deadline) < new Date(),
    }));
  }

  /**
   * Get drive detail with applications
   */
  async getDriveById(driveId: string, userId: string, userRole: string) {
    const drive = await prisma.placementDrive.findUnique({
      where: { id: driveId },
      include: {
        createdBy: {
          select: { id: true, fullName: true, username: true, email: true },
        },
        applications: {
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                username: true,
                email: true,
                placementProfile: true,
              },
            },
          },
          orderBy: { appliedAt: 'desc' },
        },
      },
    });

    if (!drive) {
      throw notFound('Placement drive');
    }

    if (userRole === 'STUDENT') {
      const studentProfile = await prisma.placementProfile.findUnique({
        where: { userId },
      });
      const application = drive.applications.find((app: any) => app.studentId === userId);

      let isEligible = true;
      const reasons: string[] = [];
      if (!studentProfile) {
        isEligible = false;
        reasons.push('Please complete placement registration profile');
      } else {
        if (drive.eligibilityCgpa > 0 && studentProfile.cgpa < drive.eligibilityCgpa) {
          isEligible = false;
          reasons.push(`Minimum CGPA: ${drive.eligibilityCgpa} (Yours: ${studentProfile.cgpa})`);
        }
        const branches = Array.isArray(drive.eligibleBranches) ? (drive.eligibleBranches as string[]) : [];
        if (branches.length > 0 && (!studentProfile.branch || !branches.includes(studentProfile.branch))) {
          isEligible = false;
          reasons.push(`Eligible branches: ${branches.join(', ')}`);
        }
        if (drive.maxBacklogs !== undefined && drive.maxBacklogs !== null && studentProfile.activeBacklogs > drive.maxBacklogs) {
          isEligible = false;
          reasons.push(`Max backlogs: ${drive.maxBacklogs} (You have: ${studentProfile.activeBacklogs})`);
        }
        if (drive.minTenthPercent && studentProfile.tenthPercentage && studentProfile.tenthPercentage < drive.minTenthPercent) {
          isEligible = false;
          reasons.push(`Min 10th: ${drive.minTenthPercent}% (Yours: ${studentProfile.tenthPercentage}%)`);
        }
        if (drive.minTwelfthPercent && studentProfile.twelfthPercentage && studentProfile.twelfthPercentage < drive.minTwelfthPercent) {
          isEligible = false;
          reasons.push(`Min 12th: ${drive.minTwelfthPercent}% (Yours: ${studentProfile.twelfthPercentage}%)`);
        }
        if (drive.batchYear && studentProfile.graduationYear && studentProfile.graduationYear !== drive.batchYear) {
          isEligible = false;
          reasons.push(`Target Batch: ${drive.batchYear} (Yours: ${studentProfile.graduationYear})`);
        }
      }

      return {
        ...drive,
        applications: undefined, // Hide other students' applications from student
        applicantCount: drive.applications.length,
        hasApplied: !!application,
        applicationStatus: application?.status || null,
        appliedAt: application?.appliedAt || null,
        isEligible,
        eligibilityReason: reasons.join('; '),
      };
    }

    return {
      ...drive,
      applicantCount: drive.applications.length,
    };
  }

  /**
   * Create a new placement drive (Admin / Teacher / Staff)
   */
  async createDrive(createdById: string, input: CreateDriveInput) {
    const drive = await prisma.placementDrive.create({
      data: {
        companyName: input.companyName,
        role: input.role,
        description: input.description || null,
        driveType: input.driveType || 'ON_CAMPUS',
        eligibilityCgpa: input.eligibilityCgpa !== undefined ? Number(input.eligibilityCgpa) : 0,
        eligibleBranches: input.eligibleBranches || [],
        maxBacklogs: input.maxBacklogs !== undefined && input.maxBacklogs !== null ? Number(input.maxBacklogs) : 0,
        minTenthPercent: input.minTenthPercent !== undefined && input.minTenthPercent !== null ? Number(input.minTenthPercent) : null,
        minTwelfthPercent: input.minTwelfthPercent !== undefined && input.minTwelfthPercent !== null ? Number(input.minTwelfthPercent) : null,
        batchYear: input.batchYear !== undefined && input.batchYear !== null ? Number(input.batchYear) : null,
        ctcLpa: input.ctcLpa !== undefined ? Number(input.ctcLpa) : null,
        location: input.location || null,
        deadline: new Date(input.deadline),
        driveDate: input.driveDate ? new Date(input.driveDate) : null,
        status: input.status || 'UPCOMING',
        selectionProcess: input.selectionProcess || [
          'Resume Screening',
          'Online Assessment',
          'Technical Interview',
          'HR Round',
        ],
        createdById,
      },
    });
    return drive;
  }

  /**
   * Update drive
   */
  async updateDrive(driveId: string, input: Partial<CreateDriveInput>) {
    const existing = await prisma.placementDrive.findUnique({ where: { id: driveId } });
    if (!existing) {
      throw notFound('Placement drive');
    }

    const data: any = {};
    if (input.companyName !== undefined) data.companyName = input.companyName;
    if (input.role !== undefined) data.role = input.role;
    if (input.description !== undefined) data.description = input.description;
    if (input.driveType !== undefined) data.driveType = input.driveType;
    if (input.eligibilityCgpa !== undefined) data.eligibilityCgpa = Number(input.eligibilityCgpa);
    if (input.eligibleBranches !== undefined) data.eligibleBranches = input.eligibleBranches;
    if (input.maxBacklogs !== undefined) data.maxBacklogs = Number(input.maxBacklogs);
    if (input.minTenthPercent !== undefined) data.minTenthPercent = input.minTenthPercent !== null ? Number(input.minTenthPercent) : null;
    if (input.minTwelfthPercent !== undefined) data.minTwelfthPercent = input.minTwelfthPercent !== null ? Number(input.minTwelfthPercent) : null;
    if (input.batchYear !== undefined) data.batchYear = input.batchYear !== null ? Number(input.batchYear) : null;
    if (input.ctcLpa !== undefined) data.ctcLpa = Number(input.ctcLpa);
    if (input.location !== undefined) data.location = input.location;
    if (input.deadline !== undefined) data.deadline = new Date(input.deadline);
    if (input.driveDate !== undefined) data.driveDate = input.driveDate ? new Date(input.driveDate) : null;
    if (input.status !== undefined) data.status = input.status;
    if (input.selectionProcess !== undefined) data.selectionProcess = input.selectionProcess;

    return prisma.placementDrive.update({
      where: { id: driveId },
      data,
    });
  }

  /**
   * Delete drive
   */
  async deleteDrive(driveId: string) {
    const existing = await prisma.placementDrive.findUnique({ where: { id: driveId } });
    if (!existing) {
      throw notFound('Placement drive');
    }
    return prisma.placementDrive.delete({ where: { id: driveId } });
  }

  /**
   * Apply for a placement drive (Student)
   */
  async applyForDrive(driveId: string, studentId: string) {
    const drive = await prisma.placementDrive.findUnique({ where: { id: driveId } });
    if (!drive) {
      throw notFound('Placement drive');
    }

    if (new Date(drive.deadline) < new Date()) {
      throw badRequest('Deadline has passed for this placement drive');
    }

    if (drive.status === 'COMPLETED' || drive.status === 'CANCELLED') {
      throw badRequest(`This drive is no longer accepting applications (Status: ${drive.status})`);
    }

    const profile = await prisma.placementProfile.findUnique({ where: { userId: studentId } });
    if (!profile) {
      throw badRequest('Please complete your Placement Registration Profile first before applying');
    }

    if (drive.eligibilityCgpa > 0 && profile.cgpa < drive.eligibilityCgpa) {
      throw badRequest(
        `Eligibility criteria not met: Required CGPA is ${drive.eligibilityCgpa}, but your CGPA is ${profile.cgpa}`
      );
    }

    const branches = Array.isArray(drive.eligibleBranches) ? (drive.eligibleBranches as string[]) : [];
    if (branches.length > 0 && (!profile.branch || !branches.includes(profile.branch))) {
      throw badRequest(
        `Eligibility criteria not met: Allowed branches are ${branches.join(', ')}, but your branch is ${profile.branch || 'unspecified'}`
      );
    }

    if (drive.maxBacklogs !== undefined && drive.maxBacklogs !== null && profile.activeBacklogs > drive.maxBacklogs) {
      throw badRequest(
        `Eligibility criteria not met: Maximum allowed backlogs is ${drive.maxBacklogs}, but you have ${profile.activeBacklogs}`
      );
    }

    if (drive.minTenthPercent && profile.tenthPercentage && profile.tenthPercentage < drive.minTenthPercent) {
      throw badRequest(
        `Eligibility criteria not met: Minimum 10th marks required is ${drive.minTenthPercent}%, but you have ${profile.tenthPercentage}%`
      );
    }

    if (drive.minTwelfthPercent && profile.twelfthPercentage && profile.twelfthPercentage < drive.minTwelfthPercent) {
      throw badRequest(
        `Eligibility criteria not met: Minimum 12th marks required is ${drive.minTwelfthPercent}%, but you have ${profile.twelfthPercentage}%`
      );
    }

    if (drive.batchYear && profile.graduationYear && profile.graduationYear !== drive.batchYear) {
      throw badRequest(
        `Eligibility criteria not met: Drive is for graduation year ${drive.batchYear}, but your year is ${profile.graduationYear}`
      );
    }

    const existingApplication = await prisma.placementApplication.findUnique({
      where: {
        driveId_studentId: {
          driveId,
          studentId,
        },
      },
    });

    if (existingApplication) {
      throw badRequest('You have already applied for this placement drive');
    }

    return prisma.placementApplication.create({
      data: {
        driveId,
        studentId,
        status: 'APPLIED',
      },
    });
  }

  /**
   * Withdraw application
   */
  async withdrawApplication(driveId: string, studentId: string) {
    const application = await prisma.placementApplication.findUnique({
      where: {
        driveId_studentId: { driveId, studentId },
      },
    });

    if (!application) {
      throw notFound('Application');
    }

    return prisma.placementApplication.delete({
      where: { id: application.id },
    });
  }

  /**
   * Update application status and round (Admin/Teacher)
   */
  async updateApplicationStatus(
    applicationId: string,
    input: {
      status?: string;
      currentRound?: string;
      assessmentScore?: number;
      notes?: string;
    }
  ) {
    const app = await prisma.placementApplication.findUnique({ where: { id: applicationId } });
    if (!app) {
      throw notFound('Application');
    }

    const data: any = {};
    if (input.status) data.status = input.status;
    if (input.currentRound) data.currentRound = input.currentRound;
    if (input.assessmentScore !== undefined) data.assessmentScore = input.assessmentScore;
    if (input.notes !== undefined) data.notes = input.notes;

    return prisma.placementApplication.update({
      where: { id: applicationId },
      data,
      include: {
        student: {
          select: { id: true, fullName: true, username: true, email: true },
        },
        drive: {
          select: { id: true, companyName: true, role: true },
        },
      },
    });
  }

  /**
   * Get all registered student POD profiles (Admin/Teacher)
   */
  async getAllProfiles(filters?: { branch?: string; verified?: boolean; search?: string }) {
    const where: any = {};
    if (filters?.branch && filters.branch !== 'ALL') {
      where.branch = filters.branch;
    }
    if (filters?.verified !== undefined) {
      where.isVerified = filters.verified;
    }
    if (filters?.search) {
      where.OR = [
        { fullName: { contains: filters.search } },
        { rollNumber: { contains: filters.search } },
        { user: { email: { contains: filters.search } } },
      ];
    }

    return prisma.placementProfile.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, username: true, fullName: true, avatarUrl: true },
        },
      },
      orderBy: { cgpa: 'desc' },
    });
  }

  /**
   * Verify or unverify student profile (Admin/Teacher)
   */
  async verifyProfile(profileId: string, isVerified: boolean, verifiedBy: string) {
    const profile = await prisma.placementProfile.findUnique({ where: { id: profileId } });
    if (!profile) {
      throw notFound('Placement profile');
    }

    return prisma.placementProfile.update({
      where: { id: profileId },
      data: {
        isVerified,
        verifiedAt: isVerified ? new Date() : null,
        verifiedBy: isVerified ? verifiedBy : null,
      },
    });
  }

  /**
   * List candidates for assessment proctoring (Proctor / Admin / Teacher)
   */
  async getProctorCandidates(filters?: { driveId?: string; proctorStatus?: string; search?: string }) {
    const where: any = {};
    if (filters?.driveId && filters.driveId !== 'ALL') {
      where.driveId = filters.driveId;
    }
    if (filters?.proctorStatus && filters.proctorStatus !== 'ALL') {
      where.proctorStatus = filters.proctorStatus;
    }
    if (filters?.search) {
      where.OR = [
        { student: { fullName: { contains: filters.search } } },
        { student: { email: { contains: filters.search } } },
        { student: { placementProfile: { rollNumber: { contains: filters.search } } } },
      ];
    }

    return prisma.placementApplication.findMany({
      where,
      include: {
        drive: {
          select: { id: true, companyName: true, role: true, driveType: true, driveDate: true },
        },
        student: {
          select: {
            id: true,
            fullName: true,
            email: true,
            username: true,
            placementProfile: true,
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  /**
   * Update candidate proctor status (Proctor)
   */
  async updateProctorStatus(
    applicationId: string,
    input: { proctorStatus: string; proctorNotes?: string; assessmentScore?: number }
  ) {
    const app = await prisma.placementApplication.findUnique({ where: { id: applicationId } });
    if (!app) {
      throw notFound('Application');
    }

    const data: any = {
      proctorStatus: input.proctorStatus,
    };
    if (input.proctorNotes !== undefined) data.proctorNotes = input.proctorNotes;
    if (input.assessmentScore !== undefined) data.assessmentScore = input.assessmentScore;

    if (input.proctorStatus === 'CLEARED') {
      data.status = 'SHORTLISTED';
      data.currentRound = 'Technical Interview';
    } else if (input.proctorStatus === 'DISQUALIFIED') {
      data.status = 'REJECTED';
      data.currentRound = 'Disqualified (Malpractice)';
    }

    return prisma.placementApplication.update({
      where: { id: applicationId },
      data,
      include: {
        student: {
          select: { id: true, fullName: true, username: true, email: true },
        },
        drive: {
          select: { id: true, companyName: true, role: true },
        },
      },
    });
  }

  /**
   * Proctor statistics for placement assessment invigilation
   */
  async getProctorStats() {
    const [
      totalInvigilated,
      clearedCount,
      flaggedCount,
      disqualifiedCount,
      activeAssessmentDrives,
    ] = await Promise.all([
      prisma.placementApplication.count(),
      prisma.placementApplication.count({ where: { proctorStatus: 'CLEARED' } }),
      prisma.placementApplication.count({ where: { proctorStatus: 'FLAGGED' } }),
      prisma.placementApplication.count({ where: { proctorStatus: 'DISQUALIFIED' } }),
      prisma.placementDrive.count({ where: { status: 'ACTIVE' } }),
    ]);

    return {
      totalInvigilated,
      clearedCount,
      flaggedCount,
      disqualifiedCount,
      activeAssessmentDrives,
    };
  }

  /**
   * Get student's application history
   */
  async getStudentApplications(studentId: string) {
    return prisma.placementApplication.findMany({
      where: { studentId },
      include: {
        drive: true,
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  /**
   * Placement statistics for dashboard
   */
  async getStats() {
    const [
      totalRegisteredStudents,
      totalDrives,
      activeDrives,
      onCampusDrives,
      offCampusDrives,
      totalApplications,
      selectedCount,
      profiles,
      activeDrivesList,
    ] = await Promise.all([
      prisma.placementProfile.count(),
      prisma.placementDrive.count(),
      prisma.placementDrive.count({ where: { status: 'ACTIVE' } }),
      prisma.placementDrive.count({ where: { driveType: 'ON_CAMPUS' } }),
      prisma.placementDrive.count({ where: { driveType: 'OFF_CAMPUS' } }),
      prisma.placementApplication.count(),
      prisma.placementApplication.count({ where: { status: 'SELECTED' } }),
      prisma.placementProfile.findMany({ select: { branch: true } }),
      prisma.placementDrive.findMany({
        where: { status: 'ACTIVE' },
        select: { ctcLpa: true },
      }),
    ]);

    const branchMap: Record<string, number> = {};
    profiles.forEach((p) => {
      const b = p.branch || 'General';
      branchMap[b] = (branchMap[b] || 0) + 1;
    });

    const ctcValues = activeDrivesList
      .map((d) => d.ctcLpa)
      .filter((c): c is number => typeof c === 'number' && c > 0);
    const averageCtc = ctcValues.length > 0 ? ctcValues.reduce((a, b) => a + b, 0) / ctcValues.length : 0;
    const highestCtc = ctcValues.length > 0 ? Math.max(...ctcValues) : 0;

    return {
      totalRegisteredStudents,
      totalDrives,
      activeDrives,
      onCampusDrives,
      offCampusDrives,
      totalApplications,
      selectedCount,
      averageCtc,
      highestCtc,
      byBranch: branchMap,
      placementRate: totalRegisteredStudents > 0 ? ((selectedCount / totalRegisteredStudents) * 100).toFixed(1) : '0',
    };
  }
}

export const placementService = new PlacementService();
